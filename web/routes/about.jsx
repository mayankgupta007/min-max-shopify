import React, { useCallback } from "react";
import { Page, Text } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";

export default function About() {
  const app = useAppBridge();
  
  const handleBackAction = useCallback(() => {
    const redirect = Redirect.create(app);
    redirect.dispatch(Redirect.Action.APP, '/');
  }, [app]);

  return (
    <Page
      title="About"
      backAction={{
        content: "Dashboard",
        onAction: handleBackAction
      }}
    >
      <Text variant="bodyMd" as="p">
        This is a simple Shopify Embedded App.
      </Text>
    </Page>
  );
}
