import React, { useState, useEffect } from "react";
import { Card, TextField, Button, DataTable, Banner, Spinner, Box, Text } from "@shopify/polaris";
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
    // Reset state when switching products
    setLimits([]);
    setMinLimit(0);
    setMaxLimit(0);
    
    // Only attempt to fetch if we have a valid product
    if (selectedProduct && selectedProduct.id) {
      try {
        const numericId = extractNumericId(selectedProduct.id);
        setProductIdDisplay(numericId.toString());
        // Only try to fetch after we've confirmed the ID is valid
        handleFetchOrderLimit(numericId);
      } catch (error) {
        console.error("Error extracting numeric product ID:", error);
        setProductIdDisplay("Invalid ID");
        setStatusMessage({
          content: `Invalid product ID: ${error.message}`,
          status: "error"
        });
      }
    } else {
      // Reset state when no product is selected
      setProductIdDisplay("");
      console.log("No product selected or product ID is missing");
    }
  }, [selectedProduct]);

  const handleSaveLimits = async () => {
    if (!selectedProduct || !selectedProduct.id) {
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
        productName: selectedProduct.title || `Product ${numericProductId}`, // Fallback for missing title
      };
      
      console.log("Saving order limit with data:", data);
      const result = await saveOrderLimit(data);
      
      setStatusMessage({
        content: `Order limits saved successfully for ${selectedProduct.title}.`,
        status: "success"
      });
      
      // Refresh the displayed data with the known numeric ID
      await handleFetchOrderLimit(numericProductId);
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

// In OrderLimits.jsx - update the handleFetchOrderLimit function:

const handleFetchOrderLimit = async (providedNumericId = null) => {
  // First check if we have a selected product
  if (!selectedProduct) {
    console.log("No selectedProduct object, skipping fetch");
    return;
  }
  
  // Debug what's in the selectedProduct
  console.log("selectedProduct in handleFetchOrderLimit:", 
    JSON.stringify({
      id: selectedProduct.id,
      title: selectedProduct.title,
      type: typeof selectedProduct.id
    })
  );
  
  // Check for null/undefined ID or empty string
  if (!selectedProduct.id || selectedProduct.id === "") {
    console.log("selectedProduct has null/undefined/empty ID, skipping fetch");
    return;
  }
  
  setFetchLoading(true);
  setStatusMessage({ content: "", status: "" });

  try {
    let numericProductId = providedNumericId;
    
    // If numeric ID wasn't provided, extract it
    if (!numericProductId) {
      try {
        console.log(`Attempting to extract ID from: ${selectedProduct.id}`);
        numericProductId = extractNumericId(selectedProduct.id);
        console.log(`Successfully extracted numericProductId: ${numericProductId}`);
      } catch (error) {
        console.error("Failed to extract product ID:", error);
        setStatusMessage({
          content: `Cannot parse product ID: ${error.message}`,
          status: "error"
        });
        setFetchLoading(false);
        return; // Exit early
      }
    }
    
    if (!numericProductId) {
      console.error("numericProductId is falsy after extraction attempts");
      setStatusMessage({
        content: "Could not determine product ID",
        status: "error"
      });
      setFetchLoading(false);
      return; // Exit early
    }
    
    console.log("About to call fetchOrderLimitById with:", numericProductId);
    // Add a try/catch specifically around the fetchOrderLimitById call
    try {
      const orderLimit = await fetchOrderLimitById(numericProductId);
      handleOrderLimitResponse(orderLimit);
    } catch (error) {
      console.error("Error from fetchOrderLimitById:", error);
      setStatusMessage({
        content: `Error fetching limit: ${error.message}`,
        status: "error"
      });
    }
  } catch (error) {
    // This catch block handles other errors in the function
    console.error("General error in handleFetchOrderLimit:", error);
    
    // Don't show error message for "no limits found" since that's expected
    if (error.message && error.message.includes("No limits found")) {
      console.log("No limits found for this product (expected)");
      setLimits([]);
    } else {
      setStatusMessage({
        content: `Error: ${error.message || "Unknown error"}`,
        status: "error"
      });
    }
  } finally {
    setFetchLoading(false);
  }
};

// Helper function to handle the response from fetchOrderLimitById
const handleOrderLimitResponse = (orderLimit) => {
  // If orderLimit is null, it means the fetch completed but no limit exists
  if (orderLimit === null) {
    console.log("No order limit found for this product");
    setLimits([]);
    // Keep the form fields at their default values
    return;
  }
  
  // Check if it's a real order limit or our default "not found" object
  if (orderLimit && orderLimit.id) {
    // This is a real order limit record
    setLimits([orderLimit]);
    setMinLimit(orderLimit.minLimit || 0);
    setMaxLimit(orderLimit.maxLimit || 0);
  } else if (orderLimit && orderLimit.message === "No limits found for this product") {
    // This is our default "not found" response
    console.log("No limits found message received");
    setLimits([]);
    // Keep default form values
  } else {
    // Any other response
    setLimits(orderLimit ? [orderLimit] : []);
    if (orderLimit) {
      setMinLimit(orderLimit.minLimit || 0);
      setMaxLimit(orderLimit.maxLimit || 0);
    }
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
                      limit.productId !== undefined ? String(limit.productId) : 'N/A',
                      limit.minLimit !== undefined ? limit.minLimit : 'N/A',
                      limit.maxLimit !== undefined ? limit.maxLimit : 'N/A'
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
