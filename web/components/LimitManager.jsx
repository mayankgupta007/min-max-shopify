import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  DataTable,
  Spinner,
  Text,
  EmptyState,
  Button,
  TextField,
  Badge,
  Modal,
  TextContainer,
  Pagination
} from "@shopify/polaris";
import { api } from "../api";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";
// import { useAuthenticatedFetch } from "../hooks/useAuthenticatedFetch"; // Add this import

function LimitManager() {
  // State for data
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [currentShopId, setCurrentShopId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // State for filtering, sorting, pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("productName");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [cursors, setCursors] = useState([]); // Store cursors for pagination

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [limitToDelete, setLimitToDelete] = useState(null);

  const app = useAppBridge();

  useEffect(() => {
    // Debug App Bridge
    console.log('App Bridge Status:', {
      appExists: !!app,
      shopifyObject: window.shopify ? 'exists' : 'missing',
      isEmbedded: window !== window.parent,
      hostname: window.location.hostname,
      URL: window.location.href
    });

    // Try to inspect app object
    if (app) {
      try {
        console.log('App Bridge instance details:', {
          hasConfig: !!app.getConfig,
          apiKey: app.apiKey || 'unknown',
        });
      } catch (e) {
        console.error('Error inspecting App Bridge:', e);
      }
    }
  }, [app]);

  // First, check if we're in an embedded app without trying to fetch Shopify data yet
  // First, check if we're in an embedded app without trying to fetch Shopify data yet
  // First, check authentication status without trying to access restricted resources
  // First, check authentication status using the dedicated action
  useEffect(() => {
    let isMounted = true;
    let checkAttempts = 0;
    let timeoutId = null;

    setLoading(true);
    setIsAuthenticated(false); // Start with not authenticated

    const checkAuthentication = async () => {
      try {
        console.log(`Checking authentication (attempt ${checkAttempts + 1})...`);
    
        // Extract shop from URL
        const currentShopDomain = new URLSearchParams(window.location.search).get('shop');
        console.log("Shop domain from URL:", currentShopDomain);
    
        // Use our special global action that's allowed for unauthenticated users
        // Pass the shop domain to the action
        const result = await api.getShopSession({
          shopDomain: currentShopDomain
        });
        console.log('Auth check result:', result);
    
        // Rest of the function remains the same
        if (result && result.authenticated && result.shopId) {
          console.log('Successfully authenticated with shop ID:', result.shopId);
          console.log('Shop domain:', result.shopDomain || 'Unknown');
    
          // If this is a development fallback, log it
          if (result.isDevelopmentFallback) {
            console.warn('Using development fallback authentication - not for production use');
          }
    
          if (isMounted) {
            setIsAuthenticated(true);
            setCurrentShopId(result.shopId);
            setLoading(false);
          }
        }
        // Rest of the function continues as before...
         else if (checkAttempts < 3) { // Reduce the number of retries
          // Not authenticated yet, retry with fewer attempts
          checkAttempts++;
          const delay = Math.min(1000 * checkAttempts, 3000);
          console.log(`Not authenticated yet, retrying in ${delay}ms...`);

          if (isMounted) {
            timeoutId = setTimeout(checkAuthentication, delay);
          }
        } else {
          // After the reduced attempts, try the development fallback directly
          // After the reduced attempts, try the development fallback directly
          console.log("Regular authentication failed, checking for development fallback...");

          try {
            // Get current shop from URL
            const currentShopDomain = new URLSearchParams(window.location.search).get('shop');
            console.log("Development authentication - using shop from URL:", currentShopDomain);
            
            // Call getShopSession with the shop domain
            if (currentShopDomain) {
              const result = await api.getShopSession({
                shopDomain: currentShopDomain
              });
              
              if (result && result.authenticated && result.shopId) {
                console.log('Successfully authenticated with shop ID:', result.shopId);
                console.log('Shop domain:', result.shopDomain || 'Unknown');
                
                if (isMounted) {
                  setIsAuthenticated(true);
                  setCurrentShopId(result.shopId);
                  setLoading(false);
                  return; // Exit early on success
                }
              }
            }
            
            // Last resort fallback without a specific domain
            const fallbackResult = await api.getShopSession();
            if (fallbackResult && fallbackResult.authenticated && fallbackResult.shopId) {
              console.warn('Last resort fallback authentication succeeded');
              
              if (isMounted) {
                setIsAuthenticated(true);
                setCurrentShopId(fallbackResult.shopId);
                setLoading(false);
              }
            } else {
              console.error("All authentication methods failed");
            }
          } catch (fallbackError) {
            console.error("Development fallback completely failed:", fallbackError);
          }


          // If we get here, all authentication methods failed
          console.log("Failed to authenticate after multiple attempts");
          if (isMounted) {
            setIsAuthenticated(false);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        if (isMounted) {
          setIsAuthenticated(false);
          setLoading(false);
        }
      }
    };

    // Start the authentication check process
    checkAuthentication();

    // Clean up on unmount
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [api]);





  // Search debouncing
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      // Reset pagination when search changes
      if (searchQuery !== debouncedSearchQuery) {
        setCurrentPage(1);
        setCursor(null);
        setCursors([]);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, debouncedSearchQuery]);

  // Only load order limits when authenticated and we have shop ID
  useEffect(() => {
    if (isAuthenticated && currentShopId) {
      console.log("Loading order limits for shop:", currentShopId);
      loadOrderLimits();
    } else if (isAuthenticated) {
      // We're authenticated but don't have a shop ID - could be a non-merchant user or other error
      console.log("Authenticated but no shop ID available");
      setLimits([]);
      setLoading(false);
    } else {
      // Not authenticated, don't try to load anything
      console.log("Not authenticated, skipping order limit load");
      setLimits([]);
      setLoading(false);
    }
  }, [isAuthenticated, currentShopId, debouncedSearchQuery, sortField, sortDirection, currentPage]);

  // Only fetch count if authenticated with a shop ID
  useEffect(() => {
    if (isAuthenticated && currentShopId) {
      fetchTotalCount();
    }
  }, [isAuthenticated, currentShopId, debouncedSearchQuery]);

  // Fetch the total count of items (for pagination info)
  const fetchTotalCount = async () => {
    if (!currentShopId) {
      console.log("No shop ID available, skipping count fetch");
      return;
    }

    try {
      // Always include shop filter
      // Always include shop filter
      const filterObj = {
        shop: { id: { equals: currentShopId } } // Correct relationship field
      };

      // Add search filter if needed
      if (debouncedSearchQuery) {
        filterObj.AND = [
          {
            OR: [
              { productName: { contains: debouncedSearchQuery } },
              ...(isNaN(parseInt(debouncedSearchQuery, 10))
                ? []
                : [{ productId: { equals: parseInt(debouncedSearchQuery, 10) } }])
            ]
          }
        ];
      }

      const countParams = {
        filter: filterObj
      };

      console.log("Fetching count with params:", countParams);
      const response = await api.OrderLimit.findMany(countParams);

      // Determine total based on the response format
      if (Array.isArray(response)) {
        setTotalItems(response.length);
        console.log(`Total items (array): ${response.length}`);
      } else if (response && response.edges) {
        setTotalItems(response.edges.length);
        console.log(`Total items (edges): ${response.edges.length}`);
      } else if (response && typeof response === 'object' && response.id) {
        // Single record case
        setTotalItems(1);
        console.log('Total items: 1 (single record)');
      } else {
        console.log('Unable to determine total count from response');
        setTotalItems(0);
      }
    } catch (error) {
      console.error("Error fetching total count:", error);
      // Don't show error UI for count failures
    }
  };

  const loadOrderLimits = async () => {
    if (!currentShopId) {
      console.log("No shop ID available, skipping data load");
      setLimits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query parameters with shop filter
      const queryParams = {
        first: pageSize
      };

      // Add cursor for pagination if needed
      if (currentPage > 1 && cursors[currentPage - 2]) {
        queryParams.after = cursors[currentPage - 2];
      }

      // ALWAYS include the shop filter
      const filterObj = {
        shop: { id: { equals: currentShopId } } // Correct relationship field
      };

      // Add search criteria if exists
      if (debouncedSearchQuery) {
        filterObj.AND = [
          {
            OR: [
              { productName: { contains: debouncedSearchQuery } },
              ...(isNaN(parseInt(debouncedSearchQuery, 10))
                ? []
                : [{ productId: { equals: parseInt(debouncedSearchQuery, 10) } }])
            ]
          }
        ];
      }

      // Add filter to query params
      queryParams.filter = filterObj;

      // Add sorting
      if (sortField) {
        queryParams.sort = {
          [sortField]: sortDirection === 'asc' ? 'Ascending' : 'Descending'
        };
      }

      console.log("Fetching with params:", queryParams);
      const response = await api.OrderLimit.findMany(queryParams);

      // Extract limit items based on response format
      let limitItems = [];
      let pageInfo = null;

      if (Array.isArray(response)) {
        console.log("Response is a direct array of items");
        limitItems = response;
        // No pagination info in this format
        setHasNextPage(false);
      } else if (response && response.edges) {
        console.log("Response has edges/nodes structure");
        limitItems = response.edges.map(edge => edge.node);
        pageInfo = response.pageInfo;
        setHasNextPage(pageInfo?.hasNextPage || false);

        // Store cursor for pagination
        if (pageInfo?.endCursor && !cursors[currentPage - 1]) {
          setCursors(prev => {
            const newCursors = [...prev];
            newCursors[currentPage - 1] = pageInfo.endCursor;
            return newCursors;
          });
        }
      } else {
        console.log("Unexpected response format, best effort extraction");
        // If it looks like a single record, use it as a single-item array
        if (response && (response.id || response.productId)) {
          limitItems = [response];
        }
        setHasNextPage(false);
      }

      console.log(`Extracted ${limitItems.length} limit items:`, limitItems);
      setLimits(limitItems);
      setHasPrevPage(currentPage > 1);

      // Fallback count for pagination display
      if (!totalItems) {
        setTotalItems(Math.max(limitItems.length, currentPage * pageSize));
      }

    } catch (err) {
      console.error("Error loading order limits:", err);
      setError("Failed to load order limits. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (limitId) => {
    // For future enhancement: Navigate to edit page or show edit modal
    alert(`Edit limit with ID: ${limitId}`);
  };

  const openDeleteModal = (limitId) => {
    const limitToDelete = limits.find(limit => limit.id === limitId);
    setLimitToDelete(limitToDelete);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!limitToDelete) return;

    try {
      await api.OrderLimit.delete(limitToDelete.id);

      // After deletion, reload the current page data
      loadOrderLimits();

      // Also update the total count
      fetchTotalCount();

      // Close the modal
      setDeleteModalOpen(false);
      setLimitToDelete(null);
    } catch (error) {
      console.error("Error deleting limit:", error);
      alert(`Failed to delete limit: ${error.message || 'Unknown error'}`);
    }
  };

  // Function to navigate to Product Limit page
  const navigateToProductLimit = () => {
    if (app) {
      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.APP, '/product-limit');
    }
  };

  // Handle sort toggle
  const handleSort = (field) => {
    // If clicking the same field, toggle direction
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as sort field with asc direction
      setSortField(field);
      setSortDirection('asc');
    }

    // Reset pagination when sort changes
    setCurrentPage(1);
    setCursor(null);
    setCursors([]);
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Styling for the CTA button to match EmptyState button
  const ctaButtonStyle = {
    backgroundColor: '#212b36',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '2.25rem',
    lineHeight: '1.25rem',
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '6.25rem'
  };

  // Create custom sort headers with indicators
  const renderSortableHeader = (title, field) => {
    const isActive = sortField === field;
    const direction = sortDirection === 'asc' ? '↑' : '↓';

    return (
      <button
        onClick={() => handleSort(field)}
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: '14px',
          fontWeight: isActive ? 'bold' : 'normal',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          color: isActive ? '#2c6ecb' : 'inherit'
        }}
      >
        {title}
        {isActive && <span style={{ marginLeft: '4px' }}>{direction}</span>}
      </button>
    );
  };

  // Custom row rendering with better UI
  const renderTableRows = () => {
    return limits.map((limit) => [
      <div>
        <Text variant="bodyMd" fontWeight="bold">{limit.productName || `Product ${limit.productId}`}</Text>
        <div style={{ fontSize: '12px', color: '#637381' }}>{`ID: ${limit.productId}`}</div>
      </div>,
      <Badge status={limit.minLimit > 0 ? "info" : "success"}>
        {limit.minLimit?.toString() || "0"}
      </Badge>,
      <Badge status={limit.maxLimit < 10 ? "warning" : "success"}>
        {limit.maxLimit?.toString() || "0"}
      </Badge>,
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button size="slim" onClick={() => handleEdit(limit.id)}>Edit</Button>
        <Button size="slim" destructive onClick={() => openDeleteModal(limit.id)}>Delete</Button>
      </div>
    ]);
  };

  const renderContent = () => {
    console.log("Rendering content with:", {
      isAuthenticated,
      hasShopId: !!currentShopId,
      loading,
      limitsCount: limits.length
    });

    // Handle case where we're not authenticated
    if (!isAuthenticated) {
      return (
        <EmptyState
          heading="Shopify Admin Required"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>This app must be accessed through the Shopify Admin.</p>
          <p>Please open this app from your Shopify Admin dashboard.</p>
        </EmptyState>
      );
    }

    // Handle the case where we're authenticated but still loading shop data
    if (loading && !currentShopId) {
      return (
        <div style={{ textAlign: "center", padding: "16px" }}>
          <Spinner accessibilityLabel="Loading shop data" size="large" />
          <div style={{ marginTop: "8px" }}>Loading shop information...</div>
        </div>
      );
    }

    // If we're authenticated but couldn't get a shop ID (unusual error case)
    if (!loading && !currentShopId) {
      return (
        <div style={{ padding: "16px" }}>
          <EmptyState
            heading="Shop Data Unavailable"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Unable to load shop information. Please refresh or reinstall the app.</p>
          </EmptyState>
        </div>
      );
    }

    // Now handle normal loading cases when we have a shop ID
    if (loading && currentPage === 1) {
      return (
        <div style={{ textAlign: "center", padding: "16px" }}>
          <Spinner accessibilityLabel="Loading limits" size="large" />
          <div style={{ marginTop: "8px" }}>Loading product limits...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ padding: "16px" }}>
          <div style={{ color: 'red', marginBottom: '12px' }}>{error}</div>
          <Button onClick={loadOrderLimits}>Try Again</Button>
        </div>
      );
    }

    // Display limits table or search results
    if (limits.length > 0 || debouncedSearchQuery) {
      const noResultsFound = limits.length === 0 && debouncedSearchQuery;

      return (
        <div>
          {/* Header with title and CTA button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 0 16px 0'
          }}>
            <Text variant="headingMd">Product Limits</Text>

            <button
              onClick={navigateToProductLimit}
              style={ctaButtonStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#0e1418';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#212b36';
              }}
            >
              Add Product Limit
            </button>
          </div>

          {/* Search and filter section */}
          <div style={{ marginBottom: '16px' }}>
            <TextField
              label=""
              type="search"
              placeholder="Search by product name or ID"
              value={searchQuery}
              onChange={(value) => setSearchQuery(value)}
              clearButton
              onClearButtonClick={() => setSearchQuery('')}
            />
          </div>

          {/* Show loading indicator during refetching */}
          {loading && currentPage > 1 && (
            <div style={{ textAlign: "center", padding: "16px" }}>
              <Spinner accessibilityLabel="Loading limits" size="small" />
            </div>
          )}

          {/* Show message when search has no results */}
          {noResultsFound ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              background: '#f9fafb',
              borderRadius: '4px'
            }}>
              <Text variant="bodySm" color="subdued">
                No products found matching "{debouncedSearchQuery}".
                Try adjusting your search.
              </Text>
              <div style={{ marginTop: '12px' }}>
                <Button onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              </div>
            </div>
          ) : (
            /* Enhanced DataTable with sorting and better styling */
            <div style={{
              border: '1px solid #dfe3e8',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "text"]}
                headings={[
                  renderSortableHeader("Product Name", "productName"),
                  renderSortableHeader("Min Quantity", "minLimit"),
                  renderSortableHeader("Max Quantity", "maxLimit"),
                  "Actions"
                ]}
                rows={renderTableRows()}
                hoverable={true}
                verticalAlign="center"
              />
            </div>
          )}

          {/* Pagination controls */}
          {!noResultsFound && limits.length > 0 && (
            <div style={{
              marginTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Results count */}
              <div style={{
                color: '#637381',
                fontSize: '13px'
              }}>
                Showing page {currentPage} of {Math.max(1, Math.ceil(totalItems / pageSize))}
                {totalItems > 0 && ` (${totalItems} total)`}
              </div>

              {/* Pagination buttons */}
              <div>
                <Pagination
                  hasPrevious={hasPrevPage}
                  onPrevious={handlePrevPage}
                  hasNext={hasNextPage}
                  onNext={handleNextPage}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default empty state when no limits and no search
    return (
      <EmptyState
        heading="No product limits found"
        action={{
          content: "Add Product Limit",
          onAction: navigateToProductLimit
        }}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>No product order limits have been set yet.</p>
      </EmptyState>
    );
  };


  return (
    <Card>
      <div style={{ padding: '16px' }}>
        {renderContent()}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete product limit"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: handleDeleteConfirm,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <p>
              Are you sure you want to delete the limit for{' '}
              <strong>{limitToDelete?.productName || `Product ${limitToDelete?.productId}`}</strong>?
            </p>
            <p>This action cannot be undone.</p>
          </TextContainer>
        </Modal.Section>
      </Modal>
    </Card>
  );
}

export default LimitManager;
