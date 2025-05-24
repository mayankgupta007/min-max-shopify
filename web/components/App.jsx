import React, { useCallback, useEffect, useState } from "react";
import { Provider as AppBridgeProvider, useAppBridge } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import Dashboard from "./Dashboard"; // The main dashboard component

function App() {
  // Debug Shopify configuration to understand what's available
  useEffect(() => {
    console.log("Shopify App Config:", {
      gadgetConfig: window.gadgetConfig,
      searchParams: new URLSearchParams(window.location.search).toString(),
      shopParam: new URLSearchParams(window.location.search).get("shop"),
      hostParam: new URLSearchParams(window.location.search).get("host"),
      environment: process.env.NODE_ENV
    });
  }, []);

  // CRITICAL FIX: Hardcode the API key from Shopify Partner Dashboard
  // This key is already public in your app URLs so it's not sensitive
  const shopifyApiKey = "43973833a3511d736c127369f6079254"; // Your Shopify API key
  
  // Extract the host from URL parameters
  const getHost = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("host");
  };
  
  const host = getHost();

  // // Create a wrapper component that handles the missing host case
  // const AppBridgeWrapper = ({ children }) => {
  //   // Only render AppBridge if we have both required params
  //   if (!apiKey || !host) {
  //     return (
  //       <div style={{ padding: "20px", maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
  //         <h1>App Configuration Error</h1>
  //         <p>Your app is not being loaded properly within Shopify admin. This could happen if:</p>
  //         <ul style={{ textAlign: "left" }}>
  //           <li>You're opening the app directly instead of through the Shopify admin</li>
  //           <li>The URL parameters are missing or not being passed correctly</li>
  //           <li>You need to reinstall the app on your store</li>
  //         </ul>
  //         <p>Try accessing your app from your Shopify admin &gt; Apps section.</p>
  //         <div style={{ marginTop: "20px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
  //           <p><strong>Debug Info:</strong></p>
  //           <p>API Key present: {apiKey ? "Yes" : "No"}</p>
  //           <p>Host present: {host ? "Yes" : "No"}</p>
  //         </div>
  //       </div>
  //     );
  //   }

  //   return (
  //     <AppBridgeProvider config={{ apiKey, host, forceRedirect: true }}>
  //       {children}
  //     </AppBridgeProvider>
  //   );
  // };

  // Log the exact config we're using for App Bridge
  console.log("Shopify App Bridge Configuration:", {
    apiKey: shopifyApiKey,
    host,
    forceRedirect: true,
    hasValidConfig: !!(shopifyApiKey && host)
  });
  
  return (
    <AppBridgeWrapper>
      <AppProvider i18n={enTranslations}>
        <Dashboard />
      </AppProvider>
    </AppBridgeWrapper>
    // <BrowserRouter>
    //   {/* If we have both API key and host, use AppBridge, otherwise render content directly */}
    //   {shopifyApiKey && host ? (
    //     <AppBridgeProvider config={{ 
    //       apiKey: shopifyApiKey, 
    //       host, 
    //       forceRedirect: true 
    //     }}>
    //       <AppProvider i18n={enTranslations} linkComponent={AdaptorLink}>
    //         <AppContent />
    //       </AppProvider>
    //     </AppBridgeProvider>
    //   ) : (
    //     <AppProvider i18n={enTranslations}>
    //       <AppContent />
    //     </AppProvider>
    //   )}
    // </BrowserRouter>
  );
}

export default App;
