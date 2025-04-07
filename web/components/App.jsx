import React, { useMemo } from "react";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import Dashboard from "./Dashboard"; // The main dashboard component

function App() {
  // Get the API key from the window.gadgetConfig, falling back to process.env if necessary
  const apiKey = window.gadgetConfig?.apiKeys?.shopify || process.env.SHOPIFY_API_KEY;
  
  // More robustly extract the host from URL parameters
  const getHost = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("host");
  };
  
  const host = getHost();

  // Create a wrapper component that handles the missing host case
  const AppBridgeWrapper = ({ children }) => {
    // Only render AppBridge if we have both required params
    if (!apiKey || !host) {
      return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
          <h1>App Configuration Error</h1>
          <p>Your app is not being loaded properly within Shopify admin. This could happen if:</p>
          <ul style={{ textAlign: "left" }}>
            <li>You're opening the app directly instead of through the Shopify admin</li>
            <li>The URL parameters are missing or not being passed correctly</li>
            <li>You need to reinstall the app on your store</li>
          </ul>
          <p>Try accessing your app from your Shopify admin &gt; Apps section.</p>
          <div style={{ marginTop: "20px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
            <p><strong>Debug Info:</strong></p>
            <p>API Key present: {apiKey ? "Yes" : "No"}</p>
            <p>Host present: {host ? "Yes" : "No"}</p>
          </div>
        </div>
      );
    }

    return (
      <AppBridgeProvider config={{ apiKey, host, forceRedirect: true }}>
        {children}
      </AppBridgeProvider>
    );
  };

  return (
    <AppBridgeWrapper>
      <AppProvider i18n={enTranslations}>
        <Dashboard />
      </AppProvider>
    </AppBridgeWrapper>
  );
}

export default App;
