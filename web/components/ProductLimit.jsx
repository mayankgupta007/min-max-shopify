// File: web/components/ProductLimit.jsx
import React, { useCallback } from "react";
import { 
  Page, 
  Layout, 
  Card, 
  Text,
  Banner,
  Box
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";

export default function ProductLimit() {
  const app = useAppBridge();
  
  // Create a redirect action using App Bridge
  const redirect = useCallback(() => {
    const redirectAction = Redirect.create(app);
    // Navigate back to the dashboard
    redirectAction.dispatch(Redirect.Action.APP, '/');
  }, [app]);

  return (
    <Page 
      title="Product Limit"
      backAction={{
        content: 'Dashboard',
        onAction: redirect
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="p" variant="bodyMd">
                This page demonstrates a properly integrated Shopify App Bridge page.
              </Text>
              <Text as="p" variant="bodyMd">
                Notice that navigation between pages now happens smoothly without jitter.
              </Text>
            </Box>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Banner
                title="App Bridge Integration"
                status="success"
              >
                <p>
                  This page uses Shopify's App Bridge navigation to ensure smooth
                  transitions between pages in the Shopify Admin.
                </p>
              </Banner>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
