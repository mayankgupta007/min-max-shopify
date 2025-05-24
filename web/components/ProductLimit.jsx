// File: web/components/ProductLimit.jsx
import React, { useState, useCallback, useEffect } from "react";
import { 
  Page, 
  Layout, 
  Card, 
  Text,
  Button,
  Box,
  InlineStack,
  Banner
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect, ResourcePicker } from "@shopify/app-bridge/actions";
import OrderLimits from "./OrderLimits";

export default function ProductLimit() {
  const app = useAppBridge();
  const [picker, setPicker] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Create a redirect action using App Bridge
  const redirectToDashboard = useCallback(() => {
    const redirectAction = Redirect.create(app);
    // Navigate back to the dashboard
    redirectAction.dispatch(Redirect.Action.APP, '/');
  }, [app]);

  // Initialize product picker
  useEffect(() => {
    if (app) {
      const resourcePicker = ResourcePicker.create(app, {
        resourceType: ResourcePicker.ResourceType.Product,
        options: {
          selectMultiple: false,
          showVariants: false,
        },
      });

      resourcePicker.subscribe(ResourcePicker.Action.SELECT, async (selectPayload) => {
        const selection = selectPayload.selection;
        if (selection && selection[0]) {
          setSelectedProduct(selection[0]);
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
  };


  const renderEmptyState = () => {
    if (!selectedProduct) {
      return (
        <Card sectioned>
          <Box paddingBlockStart="300" paddingBlockEnd="400" textAlign="center">
            <Text variant="headingMd">No Product Selected</Text>
            <Box paddingBlockStart="300">
              <Text variant="bodyMd" color="subdued">
                Select a product to set ordering limits for your customers. 
                Limits help ensure customers order within your preferred quantity range.
              </Text>
            </Box>
            <Box paddingBlockStart="400">
              <Button onClick={openProductPicker} primary size="large">
                Select a product
              </Button>
            </Box>
          </Box>
        </Card>
      );
    }
    return null;
  };

  return (
    <Page 
      title="Product Order Limits"
      backAction={{
        content: 'Dashboard',
        onAction: redirectToDashboard
      }}
    >
      {/* Add description here */}
      <Box paddingBlockEnd="400">
        <Text as="p" variant="bodyMd" color="subdued">
          Control how many items customers can purchase by setting minimum and maximum order quantities.
          This helps manage inventory and ensures customers order the appropriate amounts.
        </Text>
      </Box>
      
      {!selectedProduct && (
  <Box paddingBlockEnd="400">
    <Banner tone="info" onDismiss={() => {}}>
      <Text as="p"> 
        Start by selecting a product, then define minimum and maximum purchase quantities.
      </Text>
    </Banner>
  </Box>
)}

      <Layout>
        <Layout.Section>
          {!selectedProduct ? (
            renderEmptyState()
          ) : (
            <>
              <Card sectioned>
                <InlineStack align="space-between">
                  <Text variant="headingMd">Selected Product</Text>
                  <Button onClick={openProductPicker} plain>
                    Change product
                  </Button>
                </InlineStack>
                <Box paddingBlockStart="200">
                  <Text variant="bodyMd">{selectedProduct.title}</Text>
                  {/* {selectedProduct.id && (
                    <Text variant="bodySm" color="subdued">Product ID: {selectedProduct.id}</Text>
                  )} */}
                </Box>
                <Box paddingBlockStart="400">
                  <OrderLimits selectedProduct={selectedProduct} />
                </Box>
                <Box paddingBlockStart="400" textAlign="end">
                  <Button onClick={clearSelection} plain>
                    Cancel
                  </Button>
                </Box>
              </Card>
            </>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}