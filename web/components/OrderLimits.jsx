import React, { useState, useEffect } from "react";
import { Card, TextField, Button, DataTable, Banner, Spinner, Box, InlineStack, Text } from "@shopify/polaris";
import { fetchOrderLimitById, saveOrderLimit, extractNumericId } from "../utils/orderLimitUtils";

const OrderLimits = ({ selectedProduct }) => {
  const [minLimit, setMinLimit] = useState(0);
  const [maxLimit, setMaxLimit] = useState(0);
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ content: "", status: "" });
  const [productIdDisplay, setProductIdDisplay] = useState("");

  useEffect(() => {
    if (selectedProduct) {
      handleFetchOrderLimit();
      
      // Extract and display the numeric product ID for reference
      try {
        const numericId = extractNumericId(selectedProduct.id);
        setProductIdDisplay(numericId.toString());
      } catch (error) {
        console.error("Error extracting numeric product ID:", error);
        setProductIdDisplay("Invalid ID");
      }
    } else {
      // Reset state when no product is selected
      setLimits([]);
      setMinLimit(0);
      setMaxLimit(0);
      setProductIdDisplay("");
    }
  }, [selectedProduct]);

  const handleSaveLimits = async () => {
    if (!selectedProduct) {
      setStatusMessage({
        content: "No product selected. Please select a product first.",
        status: "error"
      });
      return;
    }

    // Validate input values
    const minLimitNum = parseInt(minLimit);
    const maxLimitNum = parseInt(maxLimit);

    if (isNaN(minLimitNum) || minLimitNum < 0) {
      setStatusMessage({
        content: "Minimum limit must be a non-negative number.",
        status: "error"
      });
      return;
    }

    if (isNaN(maxLimitNum) || maxLimitNum <= 0) {
      setStatusMessage({
        content: "Maximum limit must be a positive number.",
        status: "error"
      });
      return;
    }

    if (maxLimitNum < minLimitNum) {
      setStatusMessage({
        content: "Maximum limit cannot be less than minimum limit.",
        status: "error"
      });
      return;
    }

    setLoading(true);
    setStatusMessage({ content: "", status: "" });

    try {
      // Get the numeric product ID
      let numericProductId;
      try {
        numericProductId = extractNumericId(selectedProduct.id);
      } catch (error) {
        throw new Error(`Invalid product ID: ${error.message}`);
      }
      
      const data = {
        productId: numericProductId,
        minLimit: minLimitNum,
        maxLimit: maxLimitNum,
      };
      
      const result = await saveOrderLimit(data);
      
      setStatusMessage({
        content: `Order limits saved successfully for ${selectedProduct.title}.`,
        status: "success"
      });
      
      // Refresh the displayed data
      await handleFetchOrderLimit();
    } catch (error) {
      setStatusMessage({
        content: `Error saving order limits: ${error.message || "Unknown error"}`,
        status: "error"
      });
      console.error("Error saving order limits:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchOrderLimit = async () => {
    if (!selectedProduct) return;
    
    setFetchLoading(true);
    setStatusMessage({ content: "", status: "" });

    try {
      let numericProductId;
      try {
        numericProductId = extractNumericId(selectedProduct.id);
      } catch (error) {
        throw new Error(`Invalid product ID: ${error.message}`);
      }
      
      if (!numericProductId) {
        throw new Error("Could not determine numeric product ID");
      }
      
      const orderLimit = await fetchOrderLimitById(numericProductId);
      
      if (orderLimit) {
        setLimits([orderLimit]);
        setMinLimit(orderLimit.minLimit || 0);
        setMaxLimit(orderLimit.maxLimit || 0);
      } else {
        // No limits found, reset to defaults
        setLimits([]);
        setMinLimit(0);
        setMaxLimit(0);
      }
    } catch (error) {
      setStatusMessage({
        content: `Error fetching order limit: ${error.message || "Unknown error"}`,
        status: "error"
      });
      console.error("Error fetching order limit:", error);
      
      // Reset state on error
      setLimits([]);
      setMinLimit(0);
      setMaxLimit(0);
    } finally {
      setFetchLoading(false);
    }
  };

  return (
    <Card title="Set Order Limits">
      {selectedProduct ? (
        <Box padding="400">
          {productIdDisplay && (
            <Box paddingBlockEnd="300">
              <Text as="p" variant="bodyMd">
                Product ID: <strong>{productIdDisplay}</strong>
              </Text>
            </Box>
          )}
          
          {statusMessage.content && (
            <Box paddingBlockEnd="400">
              <Banner status={statusMessage.status}>
                {statusMessage.content}
              </Banner>
            </Box>
          )}
          
          {fetchLoading ? (
            <Box padding="400" textAlign="center">
              <Spinner accessibilityLabel="Loading order limits" />
            </Box>
          ) : (
            <>
              <TextField
                label="Minimum Order Limit"
                type="number"
                value={minLimit}
                onChange={setMinLimit}
                autoComplete="off"
                min={0}
                helpText="The minimum quantity that must be ordered (0 means no minimum)"
              />
              <Box paddingBlockStart="300" paddingBlockEnd="300">
                <TextField
                  label="Maximum Order Limit"
                  type="number"
                  value={maxLimit}
                  onChange={setMaxLimit}
                  autoComplete="off"
                  min={1}
                  helpText="The maximum quantity that can be ordered"
                />
              </Box>
              
              <Box paddingBlockStart="300">
                <Button 
                  onClick={handleSaveLimits} 
                  variant="primary" 
                  loading={loading} 
                  disabled={loading || fetchLoading}
                >
                  Save Limits
                </Button>
              </Box>

              {limits.length > 0 && (
                <Box paddingBlockStart="500">
                  <Text as="h3" variant="headingMd">Current Limits</Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric']}
                    headings={['Product ID', 'Min Limit', 'Max Limit']}
                    rows={limits.map((limit) => [
                      limit.productId.toString(),
                      limit.minLimit,
                      limit.maxLimit
                    ])}
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      ) : (
        <Box padding="400">
          <Banner status="info">Please select a product to set order limits.</Banner>
        </Box>
      )}
    </Card>
  );
};

export default OrderLimits;
