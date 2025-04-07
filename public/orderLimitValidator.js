// Add this at the beginning of your orderLimitValidator.js file
(function diagnoseScriptLoading() {
  console.log("%c ORDER LIMIT VALIDATOR - DIAGNOSTIC INFO ", "background: #ff6b6b; color: white; padding: 4px;");
  console.log("Script URL:", document.currentScript?.src || "Unknown");
  console.log("Page URL:", window.location.href);
  console.log("Shop domain:", window.Shopify?.shop || document.querySelector('meta[name="shopify-shop-id"]')?.content || "Unknown");
  console.log("App proxy path:", "/apps/order-limit-app");
  
  // Check if we're on a product page
  const onProductPage = window.location.pathname.includes('/products/');
  console.log("On product page:", onProductPage);
  
  if (onProductPage) {
    // Log all potential product ID sources
    console.log("Meta tags:", document.querySelectorAll('meta[property^="og:product"]').length);
    console.log("Form for cart/add:", document.querySelector('form[action*="/cart/add"]') ? "Found" : "Not found");
  }
})();

// This should be saved in the web/public directory but accessed at the root URL
(function() {
  console.log('==== ORDER LIMIT VALIDATOR LOADED ====');
  
  // Configuration
  const APP_PROXY_PATH = '/apps/order-limit-app';
  
  function getProductId() {
    // Record all attempted methods
    const attempts = {};
    
    // Method 1: Check meta tags (most reliable)
    const productMetaTag = document.querySelector('meta[property="og:product:id"], meta[name="product-id"]');
    attempts.metaTag = productMetaTag ? productMetaTag.content : 'Not found';
    if (productMetaTag) {
      console.log('✅ Found product ID from meta tag:', productMetaTag.content);
      return productMetaTag.content;
    }
    
    // Method 2: Check JSON-LD
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
    attempts.jsonLd = 'Attempted';
    if (jsonLdScript) {
      try {
        const data = JSON.parse(jsonLdScript.textContent);
        if (data && data['@type'] === 'Product' && data.productID) {
          console.log('✅ Found product ID from JSON-LD:', data.productID);
          attempts.jsonLd = data.productID;
          return data.productID;
        }
      } catch (e) {
        attempts.jsonLd = 'Parse error';
      }
    }
    
    // Method 3: Try to get it from the URL for product pages
    const pathMatch = window.location.pathname.match(/\/products\/([^\/]+)/);
    attempts.urlPath = pathMatch ? pathMatch[1] : 'No match';
    if (pathMatch) {
      // This is a product handle, not ID
      console.log('🔍 Found product handle from URL:', pathMatch[1]);
      
      // Method 4: Try to find product ID from JSON data in the page
      const jsonElements = document.querySelectorAll('script[type="application/json"]');
      attempts.jsonElements = jsonElements.length > 0 ? 'Found' : 'Not found';
      for (const element of jsonElements) {
        try {
          const data = JSON.parse(element.textContent);
          if (data && data.product && data.product.id) {
            console.log('✅ Found product ID from JSON data:', data.product.id);
            attempts.jsonInPage = data.product.id;
            return String(data.product.id).replace(/\D/g, ''); // Extract numeric ID
          }
        } catch (e) {
          // Ignore parsing errors
          attempts.jsonInPage = 'Parse error';
        }
      }
    }
    
    // Method 5: Try to find from form
    const formElement = document.querySelector('form[action*="/cart/add"]');
    attempts.formElement = formElement ? 'Found' : 'Not found';
    if (formElement) {
      const idInput = formElement.querySelector('input[name="id"]');
      attempts.idInput = idInput ? idInput.value : 'Not found';
      if (idInput && idInput.value) {
        console.log('🔍 Found variant ID from form:', idInput.value);
        // This is a variant ID, check if we can find product ID
        const productId = idInput.getAttribute('data-product-id');
        attempts.dataProductId = productId || 'Not found';
        if (productId) {
          console.log('✅ Found product ID from form attribute:', productId);
          return productId;
        }
        
        // Method 6: Look for it elsewhere in the form
        const productInput = formElement.querySelector('input[name="product-id"], [data-product-id]');
        attempts.productInput = productInput ? 'Found' : 'Not found';
        if (productInput) {
          const pid = productInput.value || productInput.getAttribute('data-product-id');
          attempts.productInputValue = pid || 'No value';
          if (pid) {
            console.log('✅ Found product ID from product input:', pid);
            return pid;
          }
        }
      }
    }
    
    // Method 7: Look for it in DOM attributes and data properties
    attempts.domSearch = 'Attempted';
    const productContainers = document.querySelectorAll('[data-product-id], [data-product], [id*="product"]');
    if (productContainers.length > 0) {
      for (const container of productContainers) {
        const pid = container.getAttribute('data-product-id') || 
                   container.getAttribute('data-product');
        if (pid && /^\d+$/.test(pid)) {
          console.log('✅ Found product ID from container attribute:', pid);
          attempts.domSearchResult = pid;
          return pid;
        }
      }
    }
    
    console.log('❌ Could not find product ID. Attempted methods:', attempts);
    return null;
  }

  // Improved debug fetch wrapper
  const originalFetchForDebug = window.fetch;
  window.fetch = function(...args) {
    const [url, options] = args;
    if (typeof url === 'string') {
      console.log('🔍 FETCH REQUEST:', {
        url,
        options
      });
      
      // Log app proxy requests specifically
      if (url.includes('/apps/order-limit-app')) {
        console.log('📣 APP PROXY REQUEST DETECTED:', url);
      }
    }
    
    // Call original fetch but also log response
    return originalFetchForDebug.apply(this, args)
      .then(response => {
        if (typeof url === 'string' && url.includes('/apps/order-limit-app')) {
          console.log(`📣 APP PROXY RESPONSE (${response.status}):`, response);
          
          // Check content type before attempting to parse
          const contentType = response.headers.get('content-type');
          
          // Clone the response since we'll read it twice (once for logging, once for actual processing)
          if (contentType && contentType.includes('application/json')) {
            // If it's JSON, parse and log it
            response.clone().json()
              .then(data => console.log('📣 APP PROXY RESPONSE DATA:', data))
              .catch(err => console.log('📣 Could not parse response as JSON:', err));
          } else {
            // If it's not JSON, log the first part as text
            response.clone().text()
              .then(text => {
                console.log(`📣 Non-JSON response (${contentType})`);
                console.log(`📣 Response text preview: ${text.substring(0, 150)}...`);
              })
              .catch(err => console.log('📣 Could not read response text:', err));
          }
        }
        return response;
      })
      .catch(error => {
        if (typeof url === 'string' && url.includes('/apps/order-limit-app')) {
          console.log('📣 APP PROXY REQUEST ERROR:', error);
        }
        throw error;
      });
  };
  
  /**
   * Extract order limit information from HTML response
   * This function tries to find order limit data embedded in HTML content
   * @param {string} htmlContent - The HTML content to parse
   * @param {string} productId - The product ID
   * @returns {Object|null} - Extracted order limit data or null if not found
   */
  function extractOrderLimitsFromHtml(htmlContent, productId) {
    console.log('🔍 Attempting to extract order limits from HTML...');
    
    // Make a fake limits object if we can't find real ones in the HTML
    // This allows testing the validation functionality even if the API is returning HTML
    const defaultLimits = {
      minLimit: 1,
      maxLimit: 10,
      productId: productId,
      productName: "Product " + productId,
      source: "extracted-from-html",
      message: "Using default limits (extracted from HTML response)"
    };
    
    try {
      // Try to find any JSON-like content in the HTML
      // Look for patterns like data = {...} or "orderLimits": {...}
      const jsonPattern = /"?orderLimits"?\s*[:=]\s*({[^}]+})/;
      const jsonMatch = htmlContent.match(jsonPattern);
      
      if (jsonMatch && jsonMatch[1]) {
        try {
          const extractedJson = jsonMatch[1].replace(/'/g, '"');
          const data = JSON.parse(extractedJson);
          console.log('✅ Successfully extracted JSON data from HTML:', data);
          return data;
        } catch (jsonError) {
          console.warn('⚠️ Found potential JSON in HTML but failed to parse:', jsonError);
        }
      }
      
      // Try to find a table with limit information
      if (htmlContent.includes('<table') && htmlContent.includes('min') && htmlContent.includes('max')) {
        console.log('🔍 Found table in HTML that might contain limit information');
        // This would need more sophisticated parsing to extract data from a table
        // For simplicity, using default limits
      }
      
      // Look for specific text patterns in the HTML
      const minPattern = /min(?:imum)?\s*(?:limit|quantity)[:\s=]+(\d+)/i;
      const maxPattern = /max(?:imum)?\s*(?:limit|quantity)[:\s=]+(\d+)/i;
      
      const minMatch = htmlContent.match(minPattern);
      const maxMatch = htmlContent.match(maxPattern);
      
      if (minMatch || maxMatch) {
        const result = {
          ...defaultLimits,
          source: "pattern-match"
        };
        
        if (minMatch && minMatch[1]) {
          result.minLimit = parseInt(minMatch[1], 10);
        }
        
        if (maxMatch && maxMatch[1]) {
          result.maxLimit = parseInt(maxMatch[1], 10);
        }
        
        console.log('✅ Extracted limits from text patterns:', result);
        return result;
      }
      
      console.log('⚠️ Could not find limit information in HTML, using defaults');
      return defaultLimits;
    } catch (error) {
      console.error('❌ Error extracting data from HTML:', error);
      return defaultLimits;
    }
  }
  
  /**
   * Attempt to directly call the Gadget API as a fallback
   * @param {string} productId - The product ID to look up
   * @returns {Promise<Object|null>} - Order limit data or null if not found
   */
  async function directApiCall(productId) {
    try {
      console.log('\ud83d\udd04 Attempting direct API call as fallback');
      const directApiUrl = `/apps/order-limit-app/product-limits/${productId}`;
      
      console.log(`\ud83d\udd0d Direct API URL: ${directApiUrl}`);
      
      const response = await fetch(directApiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest' 
        }
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        // Handle JSON responses
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            console.log('✅ Direct API call successful:', data);
            return data;
          } catch (jsonError) {
            console.error('❌ Direct API returned invalid JSON:', jsonError);
          }
        } 
        // Handle HTML responses with proper HTML parsing
        else {
          const htmlText = await response.text();
          console.log('\ud83d\udd0d Direct API returned HTML content');
          
          // Create a DOM parser
          const parser = new DOMParser();
          const htmlDoc = parser.parseFromString(htmlText, 'text/html');
          
          // Try to extract the limits
          const minLimit = extractNumberFromHTML(htmlDoc, 'minLimit');
          const maxLimit = extractNumberFromHTML(htmlDoc, 'maxLimit');
          
          if (minLimit !== null || maxLimit !== null) {
            console.log(`✅ Extracted limits from HTML in direct API call: min=${minLimit}, max=${maxLimit}`);
            return {
              minLimit: minLimit,
              maxLimit: maxLimit,
              productId: productId,
              productName: extractTextFromHTML(htmlDoc, 'productName') || `Product ${productId}`,
              source: 'html-parsed-direct'
            };
          }
        }
      } else {
        console.error(`❌ Direct API call failed: ${response.status} ${response.statusText}`);
      }
      return null;
    } catch (error) {
      console.error('❌ Direct API call error:', error);
      return null;
    }
  }
  
  
  
  
  /**
   * Extract order limits from our database or use hardcoded defaults
   * @param {string} productId - The product ID to get limits for
   * @returns {Object} - Order limit information
   */
  function getHardcodedLimits(productId) {
    // For testing purposes, we can hardcode some limits for specific products
    const hardcodedLimits = {
      // Map product IDs to their limits
      "10111439110431": { minLimit: 1, maxLimit: 7 },  // Example product
      // Add more as needed
    };
    
    // Get limits for this product from our hardcoded map, or use defaults
    const limits = hardcodedLimits[productId] || { minLimit: 1, maxLimit: 5 };
    
    return {
      ...limits,
      productId: productId,
      productName: "Product " + productId,
      source: "hardcoded-fallback"
    };
  }
  
  /**
   * Get order limits for a product
   * Tries multiple strategies to get limits, with fallbacks
   * @param {string} productId - The product ID to fetch limits for
   * @returns {Promise<Object|null>} - Order limits or null if not available
   */
  // Public/orderLimitValidator.js - Update only the fetchOrderLimits function

// Modify only the fetchOrderLimits function in your orderLimitValidator.js
async function fetchOrderLimits(productId) {
  // Log what we're about to do
  console.log(`\ud83d\udd0e Attempting to fetch order limits for product ID: ${productId}`);
  
  try {
    // Add a timestamp to prevent caching and shop parameter to identify the shop
    const timestamp = new Date().getTime();
    const shopParam = window.Shopify?.shop || window.location.hostname;
    
    // IMPORTANT: This is the proper format for Shopify App Proxy requests
    // Format: /apps/[subpath]/[optional custom path]?shop=[shop]&timestamp=[timestamp]
    // Shopify will add the signature
    const url = `${APP_PROXY_PATH}?path=product-limits-${productId}&shop=${shopParam}&t=${timestamp}`;
    
    console.log(`\ud83d\udd0d Making request to: ${url}`);
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'  // This can help avoid some caching issues
      }
    });
    
    console.log(`\ud83d\udce5 Response status: ${response.status}`);
    const contentType = response.headers.get('content-type');
    console.log(`\ud83d\udce5 Response content type: ${contentType || 'not specified'}`);
    
    if (!response.ok) {
      console.error(`❌ Error response: ${response.status} ${response.statusText}`);
    } else {
      // Handle JSON response
      if (contentType && contentType.includes('application/json')) {
        try {
          const data = await response.json();
          console.log('✅ Successfully received JSON data:', data);
          
          if (data && (data.minLimit !== undefined || data.maxLimit !== undefined)) {
            return data;
          }
        } catch (jsonError) {
          console.error('❌ JSON parse error:', jsonError);
        }
      } 
      // Handle HTML response
      else {
        console.log(`\ud83d\udce5 Received non-JSON response, trying alternative app proxy path...`);
        
        // Try an alternative app proxy path format as a fallback
        const alternativeUrl = `${APP_PROXY_PATH}/product-limits/${productId}?shop=${shopParam}&t=${timestamp}`;
        console.log(`\ud83d\udd0d Trying alternative URL: ${alternativeUrl}`);
        
        const altResponse = await fetch(alternativeUrl, {
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (altResponse.ok) {
          const altContentType = altResponse.headers.get('content-type');
          if (altContentType && altContentType.includes('application/json')) {
            try {
              const altData = await altResponse.json();
              console.log('✅ Alternative URL succeeded:', altData);
              return altData;
            } catch (error) {
              console.error('❌ Alternative JSON parse error:', error);
            }
          }
        }
      }
    }
    
    // If we reach this point, try fallbacks
    return await directApiCall(productId) || getHardcodedLimits(productId);
  } catch (error) {
    console.error('❌ Fetch error:', error);
    return getHardcodedLimits(productId);
  }
}

  
  // Helper function to extract numbers from HTML elements
  function extractNumberFromHTML(htmlDoc, fieldName) {
    // Try multiple selector strategies
    // 1. Look for elements with specific IDs
    const idElement = htmlDoc.getElementById(fieldName);
    if (idElement) {
      const value = parseInt(idElement.textContent.trim(), 10);
      if (!isNaN(value)) return value;
    }
    
    // 2. Look for elements with the field name as a class
    const classElements = htmlDoc.getElementsByClassName(fieldName);
    if (classElements.length > 0) {
      const value = parseInt(classElements[0].textContent.trim(), 10);
      if (!isNaN(value)) return value;
    }
    
    // 3. Look for elements with data attributes
    const dataElements = htmlDoc.querySelectorAll(`[data-${fieldName}]`);
    if (dataElements.length > 0) {
      const value = parseInt(dataElements[0].getAttribute(`data-${fieldName}`), 10);
      if (!isNaN(value)) return value;
    }
    
    // 4. Look for elements containing the field name and a number
    const allElements = htmlDoc.querySelectorAll('*');
    for (const element of allElements) {
      if (element.textContent.includes(fieldName)) {
        // Try to extract a number from this element
        const numberMatch = element.textContent.match(/\d+/);
        if (numberMatch) {
          return parseInt(numberMatch[0], 10);
        }
      }
    }
    
    return null;
  }
  
  // Helper function to extract text from HTML
  function extractTextFromHTML(htmlDoc, fieldName) {
    // Similar approaches as above
    const idElement = htmlDoc.getElementById(fieldName);
    if (idElement) return idElement.textContent.trim();
    
    const classElements = htmlDoc.getElementsByClassName(fieldName);
    if (classElements.length > 0) return classElements[0].textContent.trim();
    
    const dataElements = htmlDoc.querySelectorAll(`[data-${fieldName}]`);
    if (dataElements.length > 0) return dataElements[0].getAttribute(`data-${fieldName}`);
    
    return null;
  }
  

  
  // Function to validate quantity against limits
  function validateQuantity(quantity, limits) {
    if (!limits) return { valid: true };
    
    quantity = parseInt(quantity, 10) || 0;
    
    if (limits.minLimit && quantity < limits.minLimit) {
      return {
        valid: false,
        message: `Minimum order quantity is ${limits.minLimit}`
      };
    }
    
    if (limits.maxLimit && quantity > limits.maxLimit) {
      return {
        valid: false,
        message: `Maximum order quantity is ${limits.maxLimit}`
      };
    }
    
    return { valid: true };
  }
  
  // Function to update UI with error message
  function showErrorMessage(message) {
    // Try to find an existing error message container
    let errorContainer = document.querySelector('.order-limit-error');
    
    if (!errorContainer) {
      // Create a new error container
      errorContainer = document.createElement('div');
      errorContainer.className = 'order-limit-error';
      errorContainer.style.color = 'red';
      errorContainer.style.marginTop = '10px';
      errorContainer.style.fontWeight = 'bold';
      
      // Try to insert after the quantity input or add to cart button
      const quantityInput = document.querySelector('input[name="quantity"]');
      const addToCartButton = document.querySelector('button[name="add"], input[name="add"]');
      
      if (quantityInput) {
        quantityInput.parentNode.insertBefore(errorContainer, quantityInput.nextSibling);
      } else if (addToCartButton) {
        addToCartButton.parentNode.insertBefore(errorContainer, addToCartButton);
      } else {
        // Fallback - add to form
        const form = document.querySelector('form[action*="/cart/add"]');
        if (form) {
          form.appendChild(errorContainer);
        }
      }
    }
    
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }
  
  // Function to clear error message
  function clearErrorMessage() {
    const errorContainer = document.querySelector('.order-limit-error');
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }
  
  // Function to initialize validation for add to cart forms
  async function initializeValidation() {
    const productId = getProductId();
    if (!productId) {
      console.log('Not on a product page or could not determine product ID');
      return;
    }
    
    // Fetch limits for this product
    const limits = await fetchOrderLimits(productId);
    
    if (!limits) {
      console.log('No limits could be retrieved for this product');
      return;
    }
    
    // Log the source of our limits
    console.log(`Order limits for product ${productId}:`, limits);
    console.log(`Source: ${limits.source || 'API'}`);
    console.log(`Min: ${limits.minLimit}, Max: ${limits.maxLimit}`);
    
    // Add validation to quantity input
    const quantityInputs = document.querySelectorAll('input[name="quantity"]');
    quantityInputs.forEach(input => {
      input.addEventListener('change', function() {
        const result = validateQuantity(this.value, limits);
        if (!result.valid) {
          showErrorMessage(result.message);
        } else {
          clearErrorMessage();
        }
      });
    });
    
    // Intercept form submissions
    const forms = document.querySelectorAll('form[action*="/cart/add"]');
    forms.forEach(form => {
      form.addEventListener('submit', function(e) {
        const quantityInput = this.querySelector('input[name="quantity"]');
        const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
        
        const result = validateQuantity(quantity, limits);
        if (!result.valid) {
          e.preventDefault();
          e.stopPropagation();
          showErrorMessage(result.message);
          return false;
        }
        
        clearErrorMessage();
        return true;
      }, true);
    });
    
    // Intercept fetch/XHR requests for AJAX cart additions
// Updated version of the orderLimitValidator.js script to intercept cart/change requests

// This change should be made in the fetch interception part of your file
// Replace the existing fetch interception code with this updated version:

// Intercept fetch/XHR requests for AJAX cart additions and changes
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  // Check if this is a cart/add request
  if (typeof url === 'string' && url.includes('/cart/add')) {
    console.log('Intercepted fetch cart/add request');
    
    try {
      // Parse form data if it exists
      if (options && options.body) {
        let quantity = 1;
        
        if (options.body instanceof FormData) {
          quantity = options.body.get('quantity') || 1;
        } else if (typeof options.body === 'string') {
          const params = new URLSearchParams(options.body);
          quantity = params.get('quantity') || 1;
        } else if (options.body instanceof Object) {
          quantity = options.body.quantity || 1;
        }
        
        const result = validateQuantity(quantity, limits);
        if (!result.valid) {
          showErrorMessage(result.message);
          return Promise.reject(new Error(result.message));
        }
      }
    } catch (error) {
      console.error('Error parsing fetch request:', error);
    }
  }
  
  // NEW CODE: Check if this is a cart/change request (for quantity adjustments)
  else if (typeof url === 'string' && url.includes('/cart/change') && options && options.body) {
    console.log('Intercepted fetch cart/change request');
    
    try {
      let quantity = null;
      let lineItem = null;
      
      // Parse the body to extract the new quantity
      if (typeof options.body === 'string') {
        try {
          const parsedBody = JSON.parse(options.body);
          quantity = parsedBody.quantity ? parseInt(parsedBody.quantity, 10) : null;
          lineItem = parsedBody.line;
          console.log(`Cart/change request for line ${lineItem}, quantity ${quantity}`);
        } catch (e) {
          // If not JSON, try URL encoded format
          const params = new URLSearchParams(options.body);
          quantity = params.get('quantity') ? parseInt(params.get('quantity'), 10) : null;
          lineItem = params.get('line');
        }
      } else if (options.body instanceof FormData) {
        quantity = options.body.get('quantity') ? parseInt(options.body.get('quantity'), 10) : null;
        lineItem = options.body.get('line');
      } else if (options.body instanceof Object) {
        quantity = options.body.quantity ? parseInt(options.body.quantity, 10) : null;
        lineItem = options.body.line;
      }
      
      // If we have a quantity and it's for this product (we can't be 100% sure but we try)
      if (quantity !== null) {
        console.log(`Validating cart/change quantity: ${quantity}, max: ${limits.maxLimit}`);
        
        const result = validateQuantity(quantity, limits);
        if (!result.valid) {
          showErrorMessage(result.message);
          return Promise.reject(new Error(result.message));
        }
      }
    } catch (error) {
      console.error('Error parsing cart/change request:', error);
    }
  }
  
  return originalFetch.apply(this, arguments);
};

    
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
      this._orderLimitUrl = url;
      originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
      // Check if this is a cart/add request
      if (typeof this._orderLimitUrl === 'string' && this._orderLimitUrl.includes('/cart/add')) {
        console.log('Intercepted XHR cart/add request');
        
        try {
          // Parse form data if it exists
          if (body) {
            let quantity = 1;
            
            if (body instanceof FormData) {
              quantity = body.get('quantity') || 1;
            } else if (typeof body === 'string') {
              const params = new URLSearchParams(body);
              quantity = params.get('quantity') || 1;
            }
            
            const result = validateQuantity(quantity, limits);
            if (!result.valid) {
              showErrorMessage(result.message);
              this.abort();
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing XHR request:', error);
        }
      }
      
      originalXHRSend.apply(this, arguments);
    };
    
    console.log('Order limit validation initialized for product', productId);
  }
  
  // Start validation when the page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeValidation);
  } else {
    initializeValidation();
  }
})();
