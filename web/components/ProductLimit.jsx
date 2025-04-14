// File: web/components/ProductLimit.jsx
import React, { useState, useCallback, useEffect } from "react";
import { 
  Page, 
  Layout, 
  Card, 
  Text,
  Button,
  Box 
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

  return (
    <Page 
      title="Product Limit"
      backAction={{
        content: 'Dashboard',
        onAction: redirectToDashboard
      }}
    >
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingMd">Add New Product Limit</Text>
            <Box paddingBlockStart="300">
              <Button onClick={openProductPicker} primary>
                {selectedProduct ? "Change Product" : "Select Product"}
              </Button>
              {selectedProduct && (
                <Box paddingBlockStart="300">
                  <Button onClick={clearSelection} destructive>
                    Clear Selection
                  </Button>
                </Box>
              )}
            </Box>
          </Card>

          {selectedProduct && (
            <Card sectioned>
              <Text variant="headingMd">Selected Product</Text>
              <Text variant="bodyMd">{selectedProduct.title}</Text>
              {selectedProduct.id && (
                <Text variant="bodyMd">Product ID: {selectedProduct.id}</Text>
              )}
              <OrderLimits selectedProduct={selectedProduct} />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
