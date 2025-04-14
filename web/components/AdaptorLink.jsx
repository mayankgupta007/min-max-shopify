import React from "react";
import { Link } from "react-router-dom";

// This component adapts Shopify Polaris links to work with React Router
export default function AdaptorLink({ url, children, external, ...rest }) {
  if (external) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  
  return (
    <Link to={url} {...rest}>
      {children}
    </Link>
  );
}
