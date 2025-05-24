// File: web/components/OrderLimits.jsx
import React, { useState, useEffect } from "react";
import { 
  BlockStack,
  TextField,
  Button, 
  Text, 
  Box,
  Banner,
  Spinner
} from "@shopify/polaris";
import { api } from "../api";

export default function OrderLimits({ selectedProduct }) {
  const [minLimit, setMinLimit] = useState("");
  const [maxLimit, setMaxLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isNewLimit, setIsNewLimit] = useState(true); // New state to track if this is a new limit

  // Fetch existing limits when product changes
  useEffect(() => {
    const fetchLimits = async () => {
      if (!selectedProduct?.id) return;
      
      setLoading(true);
      setError(null); // Clear any previous errors
      setIsNewLimit(true); // Assume it's new until we find otherwise
      
      try {
        // Extract the numeric ID from the Shopify ID format
        const productId = String(selectedProduct.id).split("/").pop();
        const response = await api.fetchOrderLimitByProductId({productId});
        
        if (response.success && response.data) {
          // We found existing data
          setMinLimit(response.data.minLimit?.toString() || "");
          setMaxLimit(response.data.maxLimit?.toString() || "");
          setIsNewLimit(false); // This is an existing limit
        } else {
          // No existing limits - this is normal and expected for new products
          setMinLimit("");
          setMaxLimit("");
          // Don't set an error - this is a valid state
        }
      } catch (err) {
        console.error("Error fetching limits:", err);
        // Only set error for network/server issues, not for "not found"
        if (err.message && !err.message.includes("not found")) {
          setError("There was an error connecting to the server. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
  }, [selectedProduct]);

  const handleSave = async () => {
    // Extract the numeric ID from the Shopify ID format
    const productId = String(selectedProduct.id).split("/").pop();
    const minLimitNum = minLimit ? parseInt(minLimit, 10) : null;
    const maxLimitNum = maxLimit ? parseInt(maxLimit, 10) : null;
    
    // Validation
    if (minLimitNum && maxLimitNum && minLimitNum > maxLimitNum) {
      setError("Minimum limit cannot be greater than maximum limit");
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      await api.saveOrderLimit({
        productId,
        productName: selectedProduct.title,
        minLimit: minLimitNum,
        maxLimit: maxLimitNum
      });
      
      setSuccess(true);
      setIsNewLimit(false); // After saving, it's no longer a new limit
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving limits:", err);
      setError("Failed to save limits. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box padding="400" textAlign="center">
        <BlockStack gap="300" align="center">
          <Spinner />
          <Text>Loading product limits...</Text>
        </BlockStack>
      </Box>
    );
  }

  return (
    <BlockStack gap="400">
      <Text variant="headingMd">Order Quantity Limits</Text>
      
      {/* Show appropriate messaging based on whether this is a new limit or not */}
      {isNewLimit && !error && (
        <Banner tone="info" onDismiss={() => setIsNewLimit(false)}>
          No order limits exist yet for this product. Set minimum and maximum quantities below.
        </Banner>
      )}
      
      {/* Show error only if there's a real error */}
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      
      {success && (
        <Banner tone="success" onDismiss={() => setSuccess(false)}>
          Order limits saved successfully!
        </Banner>
      )}

      <BlockStack gap="400">
        <TextField
          label="Minimum quantity"
          type="number"
          value={minLimit}
          onChange={setMinLimit}
          autoComplete="off"
          helpText="The minimum quantity a customer must add to their cart. Leave blank for no minimum."
        />
        
        <TextField
          label="Maximum quantity"
          type="number"
          value={maxLimit}
          onChange={setMaxLimit}
          autoComplete="off"
          helpText="The maximum quantity a customer can add to their cart. Leave blank for no maximum."
        />
      </BlockStack>

      <Box paddingBlockStart="200">
        <Button 
          onClick={handleSave} 
          primary 
          loading={saving}
          disabled={loading || saving}
        >
          {isNewLimit ? "Create limits" : "Update limits"}
        </Button>
      </Box>
    </BlockStack>
  );
}