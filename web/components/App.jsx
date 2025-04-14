import React, { useCallback, useEffect, useState } from "react";
import { Provider as AppBridgeProvider, useAppBridge } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { NavigationMenu } from "@shopify/app-bridge-react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { History, Redirect } from "@shopify/app-bridge/actions";
import Dashboard from "./Dashboard";
import ProductLimit from "./ProductLimit";
import About from "../routes/about";
import AdaptorLink from "./AdaptorLink";
import "./App.css";

// Navigation items shared across both navigation implementations
const navigationItems = [
  {
    label: "Dashboard",
    destination: "/",
  },
  {
    label: "Product Limit",
    destination: "/product-limit",
  },
  {
    label: "About",
    destination: "/about",
  },
];

// Component to sync React Router with App Bridge
function AppBridgeNavigationSync() {
  const app = useAppBridge();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!app) return;
    
    // This listens to App Bridge navigation and updates React Router
    const unsubscribe = History.create(app).subscribe(History.Action.PUSH, (payload) => {
      const path = payload.path;
      
      // Only navigate if we're not already at the right path
      if (path !== location.pathname) {
        navigate(path, { replace: true });
      }
    });
    
    return () => unsubscribe();
  }, [app, location.pathname, navigate]);
  
  return null;
}

// Component that wraps the actual app content
function AppContent() {
  const app = useAppBridge();
  const location = useLocation();
  
  // Determine if we're in embedded mode (inside Shopify admin)
  // We can use the app object as a proxy for determining this
  const isEmbedded = Boolean(app);

  return (
    <>
      <AppBridgeNavigationSync />
      
      {/* Always show Shopify's NavigationMenu when embedded */}
      {isEmbedded && (
        <NavigationMenu
          navigationLinks={navigationItems}
        />
      )}
      
      {/* Show simple navbar when not embedded */}
      {!isEmbedded && (
        <div className="simple-nav">
          {navigationItems.map(item => (
            <a 
              key={item.destination}
              href={item.destination}
              className={location.pathname === item.destination ? "active" : ""}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
      
      <div className="page-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/product-limit" element={<ProductLimit />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  // Get the API key from the window.gadgetConfig, falling back to process.env if necessary
  const apiKey = window.gadgetConfig?.apiKeys?.shopify || process.env.SHOPIFY_API_KEY;
  
  // Extract the host from URL parameters
  const getHost = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("host");
  };
  
  const host = getHost();
  
  // Check if we're running in development mode and not embedded in Shopify
  const isDevelopmentMode = !host || process.env.NODE_ENV === "development";

  return (
    <BrowserRouter>
      {/* If we have both API key and host, use AppBridge, otherwise render content directly */}
      {apiKey && host ? (
        <AppBridgeProvider config={{ apiKey, host, forceRedirect: true }}>
          <AppProvider i18n={enTranslations} linkComponent={AdaptorLink}>
            <AppContent />
          </AppProvider>
        </AppBridgeProvider>
      ) : (
        <AppProvider i18n={enTranslations}>
          <AppContent />
        </AppProvider>
      )}
    </BrowserRouter>
  );
}

export default App;
