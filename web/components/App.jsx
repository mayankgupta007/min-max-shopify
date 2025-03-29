import React from "react";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import Dashboard from "./Dashboard"; // The main dashboard component

function App() {
  const apiKey = window.gadgetConfig?.apiKeys?.shopify;
  const host = new URLSearchParams(window.location.search).get("host");

  return (
    <AppBridgeProvider config={{ apiKey, host, forceRedirect: true }}>
      <AppProvider i18n={enTranslations}>
        <Dashboard />
      </AppProvider>
    </AppBridgeProvider>
  );
}

export default App;
