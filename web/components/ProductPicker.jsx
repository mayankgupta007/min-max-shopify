import React, { useState, useEffect } from "react";
import { Page, Button, Banner, Box, Card, Text, InlineStack } from "@shopify/polaris"; // Added InlineStack import
import { useAppBridge } from "@shopify/app-bridge-react";
import { ResourcePicker } from "@shopify/app-bridge/actions";
import { fetchOrderLimitById, extractNumericId } from "../utils/orderLimitUtils";
import OrderLimits from "./OrderLimits";

const ProductPicker = () => {
  const app = useAppBridge();
  const [picker, setPicker] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [limits, setLimits] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (app) {
      const resourcePicker = ResourcePicker.create(app, {
        resourceType: ResourcePicker.ResourceType.Product,
        options: {
          selectMultiple: false,
          showVariants: false,
        },
      });

      // Subscribe to the SELECT action of the ResourcePicker
      resourcePicker.subscribe(ResourcePicker.Action.SELECT, async (selectPayload) => {
        const selection = selectPayload.selection;
        if (selection && selection[0]) {
          setError(null); // Reset any previous errors
          setSelectedProduct(selection[0]);
          
          try {
            // We'll let the OrderLimits component handle the fetching of limits
            // This simplifies the data flow and avoids redundant fetches
          } catch (error) {
            console.error("Error processing selected product:", error);
            setError(`Error loading product: ${error.message}`);
          }
        }
      });

      resourcePicker.subscribe(ResourcePicker.Action.CANCEL, () => {
        console.log("Resource picker was canceled.");
      });

      setPicker(resourcePicker);
    }
  }, [app]);

  const openProductPicker = () => {
    if (picker) {
      picker.dispatch(ResourcePicker.Action.OPEN);
    }
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    setLimits([]);
    setError(null);
  };

  return (
    <Box padding="400">
      <Card title="Product Selection">
        <Card.Section>
          <Text as="p" variant="bodyMd">
            Select a product to manage its order limits.
          </Text>
          
          <Box paddingBlockStart="300">
            <InlineStack gap="300">
              <Button onClick={openProductPicker} variant="primary">
                {selectedProduct ? "Change Product" : "Select Product"}
              </Button>
              
              {selectedProduct && (
                <Button onClick={clearSelection} variant="plain">
                  Clear Selection
                </Button>
              )}
            </InlineStack>
          </Box>
          
          {error && (
            <Box paddingBlockStart="300">
              <Banner status="critical">
                {error}
              </Banner>
            </Box>
          )}
          
          {selectedProduct && (
            <Box paddingBlockStart="300">
              <Banner status="success">
                Selected: <strong>{selectedProduct.title}</strong>
              </Banner>
            </Box>
          )}
        </Card.Section>
      </Card>
      
      {/* Only show OrderLimits component when a product is selected */}
      {selectedProduct && (
        <Box paddingBlockStart="400">
          <OrderLimits selectedProduct={selectedProduct} />
        </Box>
      )}
    </Box>
  );
};

export default ProductPicker;
