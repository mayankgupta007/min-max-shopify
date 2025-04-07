import React, { useState, useEffect } from 'react';
import { Card, DataTable, Spinner, Text, EmptyState, Button } from "@shopify/polaris";
import { api } from "../api";

function LimitManager() {
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <DataTable
          columnContentTypes={["text", "numeric", "numeric", "text"]}
          headings={["Product Name", "Min Quantity", "Max Quantity", "Actions"]}
          rows={rows}
        />
      );
    }
    
    return (
      <EmptyState
        heading="No product limits found"
        action={{ content: "Reload Limits", onAction: loadOrderLimits }}
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
