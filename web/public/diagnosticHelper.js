// Create a new file: web/public/diagnosticHelper.js
(function() {
  // This script helps diagnose why the order limit validation isn't working
  console.log('==== ORDER LIMIT DIAGNOSTIC HELPER LOADED ====');
  
  // Record the original fetch to see app-proxy calls
  const originalFetch = window.fetch;
  window.fetch = function() {
    const url = arguments[0];
    if (typeof url === 'string' && url.includes('order-limit-app')) {
      console.log('🔍 APP PROXY REQUEST:', {
        url,
        options: arguments[1]
      });
      
      // Return with a modified promise to log response
      return originalFetch.apply(this, arguments)
        .then(response => {
          console.log(`🔍 APP PROXY RESPONSE (${response.status}):`, response);
          // Clone the response so we can read the body
          const clone = response.clone();
          clone
