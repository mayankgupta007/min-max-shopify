
// File: web/components/AdaptorLink.jsx

import React, { useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";

// This component adapts Shopify Polaris links to work with App Bridge
export default function AdaptorLink({ url, children, external, ...rest }) {
  const app = useAppBridge();
  
  const handleClick = useCallback((e) => {
    // For external links, let the browser handle it
    if (external) {
      return;
    }
    
    // Prevent default link behavior
    e.preventDefault();
    
    // Use App Bridge redirect for internal links
    if (url) {
      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.APP, url);
    }
  }, [app, url, external]);
  
  if (external) {
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <a 
      href={url} 
      onClick={handleClick} 
      {...rest}
    >
      {children}
    </a>
  );
}
