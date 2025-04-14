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

function LimitManager() {
  // State for data
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  
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
  }, [searchQuery]);

  // Fetch data when filter, sort, or page changes
  useEffect(() => {
    loadOrderLimits();
  }, [debouncedSearchQuery, sortField, sortDirection, currentPage]);

  // Fetch total count separately (once on initial load and when search changes)
  useEffect(() => {
    fetchTotalCount();
  }, [debouncedSearchQuery]);

  // Fetch the total count of items (for pagination info)
  const fetchTotalCount = async () => {
    try {
      // Try a simple query without aggregation
      const countParams = {};
      
      if (debouncedSearchQuery) {
        countParams.filter = {
          OR: [
            { productName: { contains: debouncedSearchQuery } },
            ...(isNaN(parseInt(debouncedSearchQuery, 10)) 
              ? [] 
              : [{ productId: { equals: parseInt(debouncedSearchQuery, 10) } }])
          ]
        };
      }
      
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
    setLoading(true);
    setError(null);
  
    try {
      // Build query parameters
      const queryParams = {
        first: pageSize
      };
      
      // Add cursor for pagination if needed
      if (currentPage > 1 && cursors[currentPage - 2]) {
        queryParams.after = cursors[currentPage - 2];
      }
      
      // Add filter if search query exists
      if (debouncedSearchQuery) {
        queryParams.filter = {
          OR: [
            { productName: { contains: debouncedSearchQuery } },
            ...(isNaN(parseInt(debouncedSearchQuery, 10)) 
              ? [] 
              : [{ productId: { equals: parseInt(debouncedSearchQuery, 10) } }])
          ]
        };
      }
      
      // Add sorting
      if (sortField) {
        queryParams.sort = {
          [sortField]: sortDirection === 'asc' ? 'Ascending' : 'Descending'
        };
      }
      
      console.log("Fetching with params:", queryParams);
      const response = await api.OrderLimit.findMany(queryParams);
      
      // Debug the response structure
      console.log("Response type:", typeof response);
      console.log("Is Array:", Array.isArray(response));
      if (response && typeof response === 'object') {
        console.log("Response keys:", Object.keys(response));
      }
      
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
        {isActive && <span style={{marginLeft: '4px'}}>{direction}</span>}
      </button>
    );
  };

  // Custom row rendering with better UI
  const renderTableRows = () => {
    return limits.map((limit) => [
      <div>
        <Text variant="bodyMd" fontWeight="bold">{limit.productName || `Product ${limit.productId}`}</Text>
        <div style={{fontSize: '12px', color: '#637381'}}>{`ID: ${limit.productId}`}</div>
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
      loading,
      error,
      limitsLength: limits.length,
      limitItems: limits
    });
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
              <div style={{marginTop: '12px'}}>
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
