import React, { useState, useEffect } from 'react';
import { Card, DataTable, Spinner, Text, EmptyState, Button } from "@shopify/polaris";
import { api } from "../api";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";

function LimitManager() {
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const app = useAppBridge();

  // Fetch all order limits when component mounts
  useEffect(() => {
    loadOrderLimits();
  }, []);

  const loadOrderLimits = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("Fetching all order limits...");
      const allLimits = await api.OrderLimit.findMany();
      console.log("Fetched limits:", allLimits);
      setLimits(allLimits);
    } catch (err) {
      console.error("Error loading order limits:", err);
      setError("Failed to load order limits. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (limitId) => {
    alert(`Edit limit with ID: ${limitId}`);
  };

  const handleDelete = async (limitId) => {
    if (!window.confirm("Are you sure you want to delete this order limit?")) {
      return;
    }
    
    try {
      await api.OrderLimit.delete(limitId);
      setLimits(limits.filter(limit => limit.id !== limitId));
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

  // Create rows for the DataTable with product name instead of ID
  const rows = limits.map((limit) => [
    limit.productName || `Product ${limit.productId}`, // Explicit fallback for missing productName
    limit.minLimit?.toString() || "0",
    limit.maxLimit?.toString() || "0",
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button size="slim" onClick={() => handleEdit(limit.id)}>Edit</Button>
      <Button size="slim" destructive onClick={() => handleDelete(limit.id)}>Delete</Button>
    </div>
  ]);

  // Styling for the CTA button to match EmptyState button
  const ctaButtonStyle = {
    // These values should match your EmptyState button exactly
    backgroundColor: '#212b36', // Polaris default dark color
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
    minWidth: '6.25rem' // 100px to match EmptyState button width
  };

  const renderContent = () => {
    if (loading) {
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
    
    if (limits.length > 0) {
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
            
            {/* Custom styled button to exactly match EmptyState button */}
            <button 
              onClick={navigateToProductLimit}
              style={ctaButtonStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#0e1418'; // Darker on hover
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#212b36'; // Back to normal
              }}
            >
              Add Product Limit
            </button>
          </div>

          {/* DataTable showing the limits */}
          <DataTable
            columnContentTypes={["text", "numeric", "numeric", "text"]}
            headings={["Product Name", "Min Quantity", "Max Quantity", "Actions"]}
            rows={rows}
          />
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
    <Card title="Manage Your Limits">
      <div style={{ padding: '16px' }}>
        {renderContent()}
      </div>
    </Card>
  );
}

export default LimitManager;
