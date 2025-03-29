import React, { useState, useEffect } from "react";
import { Page, Layout, Card, Text, Button } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ResourcePicker } from "@shopify/app-bridge/actions";
import OrderLimits from "./OrderLimits"; // This import is correct

export default function Dashboard() {
  const app = useAppBridge();
  const [picker, setPicker] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

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
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingMd">Manage Order Limits</Text>
            <Button onClick={openProductPicker}>
              {selectedProduct ? "Change Product" : "Select Product"}
            </Button>
            {selectedProduct && (
              <Button onClick={clearSelection} destructive>
                Clear Selection
              </Button>
            )}
          </Card>

          {selectedProduct && (
            <Card sectioned>
              <Text variant="headingMd">Selected Product</Text>
              <Text variant="bodyMd">{selectedProduct.title}</Text>
              {selectedProduct.id && (
                <Text variant="bodyMd">
                  Product ID: {selectedProduct.id}
                </Text>
              )}
              {/* Render OrderLimits component */}
              <OrderLimits selectedProduct={selectedProduct} />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
