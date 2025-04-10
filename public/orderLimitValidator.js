// Immediate preemptive button disabling - executed synchronously
(function() {
  // Find and disable all potential checkout buttons immediately
  const selectors = ['button[name="checkout"]', 'input[name="checkout"]', '.shopify-payment-button__button', '.cart__checkout', '#checkout', '.checkout-button'];
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(button => {
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.pointerEvents = 'none';
      button.setAttribute('data-limit-preemptive-disabled', 'true');
    });
  });
})();

const DEBUG_MODE = true;
let validationInProgress = false;
let lastButtonStateUpdate = 0;
const BUTTON_UPDATE_COOLDOWN = 50; // Milliseconds to throttle button state updates
let disableCheckoutTimer = null;
let pendingValidation = false;

// Replace all debugLog calls with this function
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

// Add this at the beginning of your orderLimitValidator.js file
(function diagnoseScriptLoading() {
  debugLog("%c ORDER LIMIT VALIDATOR - DIAGNOSTIC INFO ", "background: #ff6b6b; color: white; padding: 4px;");
  debugLog("Script URL:", document.currentScript?.src || "Unknown");
  debugLog("Page URL:", window.location.href);
  debugLog("Shop domain:", window.Shopify?.shop || document.querySelector('meta[name="shopify-shop-id"]')?.content || "Unknown");
  debugLog("App proxy path:", "/apps/order-limit-app");

  // Check if we're on a product page
  const onProductPage = window.location.pathname.includes('/products/');
  debugLog("On product page:", onProductPage);

  if (onProductPage) {
    // Log all potential product ID sources
    debugLog("Meta tags:", document.querySelectorAll('meta[property^="og:product"]').length);
    debugLog("Form for cart/add:", document.querySelector('form[action*="/cart/add"]') ? "Found" : "Not found");
  }
})();

// This should be saved in the web/public directory but accessed at the root URL
(function() {
  debugLog('==== ORDER LIMIT VALIDATOR LOADED ====');

  // Configuration
  const APP_PROXY_PATH = '/apps/order-limit-app';

  function getProductId() {
    // Record all attempted methods
    const attempts = {};

    // Method 1: Check meta tags (most reliable)
    const productMetaTag = document.querySelector('meta[property="og:product:id"], meta[name="product-id"]');
    attempts.metaTag = productMetaTag ? productMetaTag.content : 'Not found';
    if (productMetaTag) {
      debugLog('✅ Found product ID from meta tag:', productMetaTag.content);
      return productMetaTag.content;
    }

    // Method 2: Check JSON-LD
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
    attempts.jsonLd = 'Attempted';
    if (jsonLdScript) {
      try {
        const data = JSON.parse(jsonLdScript.textContent);
        if (data && data['@type'] === 'Product' && data.productID) {
          debugLog('✅ Found product ID from JSON-LD:', data.productID);
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
      debugLog('🔍 Found product handle from URL:', pathMatch[1]);

      // Method 4: Try to find product ID from JSON data in the page
      const jsonElements = document.querySelectorAll('script[type="application/json"]');
      attempts.jsonElements = jsonElements.length > 0 ? 'Found' : 'Not found';
      for (const element of jsonElements) {
        try {
          const data = JSON.parse(element.textContent);
          if (data && data.product && data.product.id) {
            debugLog('✅ Found product ID from JSON data:', data.product.id);
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
        debugLog('🔍 Found variant ID from form:', idInput.value);
        // This is a variant ID, check if we can find product ID
        const productId = idInput.getAttribute('data-product-id');
        attempts.dataProductId = productId || 'Not found';
        if (productId) {
          debugLog('✅ Found product ID from form attribute:', productId);
          return productId;
        }

        // Method 6: Look for it elsewhere in the form
        const productInput = formElement.querySelector('input[name="product-id"], [data-product-id]');
        attempts.productInput = productInput ? 'Found' : 'Not found';
        if (productInput) {
          const pid = productInput.value || productInput.getAttribute('data-product-id');
          attempts.productInputValue = pid || 'No value';
          if (pid) {
            debugLog('✅ Found product ID from product input:', pid);
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
          debugLog('✅ Found product ID from container attribute:', pid);
          attempts.domSearchResult = pid;
          return pid;
        }
      }
    }

    debugLog('❌ Could not find product ID. Attempted methods:', attempts);
    return null;
  }

  // Improved debug fetch wrapper
  const originalFetchForDebug = window.fetch;
  window.fetch = function(...args) {
    const [url, options] = args;
    if (typeof url === 'string') {
      debugLog('🔍 FETCH REQUEST:', {
        url,
        options
      });

      // Log app proxy requests specifically
      if (url.includes('/apps/order-limit-app')) {
        debugLog('📣 APP PROXY REQUEST DETECTED:', url);
      }
    }

    // Call original fetch but also log response
    return originalFetchForDebug.apply(this, args)
      .then(response => {
        if (typeof url === 'string' && url.includes('/apps/order-limit-app')) {
          debugLog(`📣 APP PROXY RESPONSE (${response.status}):`, response);

          // Check content type before attempting to parse
          const contentType = response.headers.get('content-type');

          // Clone the response since we'll read it twice (once for logging, once for actual processing)
          if (contentType && contentType.includes('application/json')) {
            // If it's JSON, parse and log it
            response.clone().json()
              .then(data => debugLog('📣 APP PROXY RESPONSE DATA:', data))
              .catch(err => debugLog('📣 Could not parse response as JSON:', err));
          } else {
            // If it's not JSON, log the first part as text
            response.clone().text()
              .then(text => {
                debugLog(`📣 Non-JSON response (${contentType})`);
                debugLog(`📣 Response text preview: ${text.substring(0, 150)}...`);
              })
              .catch(err => debugLog('📣 Could not read response text:', err));
          }
        }
        return response;
      })
      .catch(error => {
        if (typeof url === 'string' && url.includes('/apps/order-limit-app')) {
          debugLog('📣 APP PROXY REQUEST ERROR:', error);
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
    debugLog('🔍 Attempting to extract order limits from HTML...');

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
          debugLog('✅ Successfully extracted JSON data from HTML:', data);
          return data;
        } catch (jsonError) {
          console.warn('⚠️ Found potential JSON in HTML but failed to parse:', jsonError);
        }
      }

      // Try to find a table with limit information
      if (htmlContent.includes('<table') && htmlContent.includes('min') && htmlContent.includes('max')) {
        debugLog('🔍 Found table in HTML that might contain limit information');
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

        debugLog('✅ Extracted limits from text patterns:', result);
        return result;
      }

      debugLog('⚠️ Could not find limit information in HTML, using defaults');
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
      debugLog('\ud83d\udd04 Attempting direct API call as fallback');
      const directApiUrl = `/apps/order-limit-app/product-limits/${productId}`;

      debugLog(`\ud83d\udd0d Direct API URL: ${directApiUrl}`);

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
            debugLog('✅ Direct API call successful:', data);
            return data;
          } catch (jsonError) {
            console.error('❌ Direct API returned invalid JSON:', jsonError);
          }
        }
        // Handle HTML responses with proper HTML parsing
        else {
          const htmlText = await response.text();
          debugLog('\ud83d\udd0d Direct API returned HTML content');

          // Create a DOM parser
          const parser = new DOMParser();
          const htmlDoc = parser.parseFromString(htmlText, 'text/html');

          // Try to extract the limits
          const minLimit = extractNumberFromHTML(htmlDoc, 'minLimit');
          const maxLimit = extractNumberFromHTML(htmlDoc, 'maxLimit');

          if (minLimit !== null || maxLimit !== null) {
            debugLog(`✅ Extracted limits from HTML in direct API call: min=${minLimit}, max=${maxLimit}`);
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


  // This is a more comprehensive fix for orderLimitValidator.js

  // Save the original fetch at the beginning of the file
  const originalFetch = window.fetch;

  // Modify the fetch interception specifically for cart/add requests
  // Store the product limits in a globally accessible variable
  let productLimits = null;
  let currentCartQuantity = 0;

  // Function to check the current cart
  async function checkCurrentCart() {
    try {
      const response = await fetch('/cart.js', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
  
      if (response.ok) {
        const cart = await response.json();
        const productId = getProductId();
        if (!productId) return 0;
  
        // Optimize this loop for speed
        let quantity = 0;
        for (let i = 0; i < cart.items.length; i++) {
          if (cart.items[i].product_id == productId) {
            quantity += cart.items[i].quantity;
          }
        }
  
        currentCartQuantity = quantity;
        return quantity;
      }
      return 0;
    } catch (error) {
      console.error("Error checking cart:", error);
      return 0;
    }
  }
  

  // Function to immediately disable checkout buttons - this gets called FIRST on any cart change
function immediatelyDisableCheckoutButtons() {
  // Record time of this update to avoid excessive updates
  const now = Date.now();
  if (now - lastButtonStateUpdate < BUTTON_UPDATE_COOLDOWN) {
    pendingValidation = true;
    return; // Skip this update as we've just updated recently
  }
  
  lastButtonStateUpdate = now;
  validationInProgress = true;
  
  // Find all checkout buttons using a comprehensive set of selectors
  const selectors = [
    'button[name="checkout"]', 
    'input[name="checkout"]', 
    '.shopify-payment-button__button', 
    '.additional-checkout-buttons button',
    '.additional-checkout-buttons a',
    '.cart__checkout', 
    '#checkout', 
    '.checkout-button',
    'a[href="/checkout"]',
    'form[action="/cart"] [type="submit"]',
    'form[action="/checkout"] [type="submit"]'
  ];
  
  // Keep track of the buttons we've found for debugging
  const foundButtons = [];
  
  // Process each selector
  selectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(button => {
        // Only store original state if we haven't already
        if (!button.hasAttribute('data-original-disabled')) {
          button.setAttribute('data-original-disabled', button.disabled || false);
          button.setAttribute('data-original-opacity', button.style.opacity || '');
          button.setAttribute('data-original-pointer-events', button.style.pointerEvents || '');
          button.setAttribute('data-original-cursor', button.style.cursor || '');
        }
        
        // Aggressively disable the button
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.pointerEvents = 'none';
        button.style.cursor = 'not-allowed';
        button.classList.add('limit-disabled');
        
        foundButtons.push(button);
      });
    } catch (e) {
      console.error(`Error finding buttons with selector ${selector}:`, e);
    }
  });
  
  debugLog(`Immediately disabled ${foundButtons.length} checkout buttons`);
  
  // Schedule a safety check to ensure validation completes
  if (disableCheckoutTimer) {
    clearTimeout(disableCheckoutTimer);
  }
  
  disableCheckoutTimer = setTimeout(() => {
    if (validationInProgress) {
      debugLog('Safety timeout: validation is taking too long, keeping buttons disabled');
      validationInProgress = false;
      // Don't re-enable buttons when the safety timeout fires
    }
  }, 5000); // 5 second safety timeout
  
  return foundButtons;
}


  // REPLACE the existing validateTotalQuantity function with this:
  function validateTotalQuantity(newQuantity, limits) {
    if (!limits) return { valid: true };

    const totalQuantity = currentCartQuantity + parseInt(newQuantity, 10);
    debugLog(`Validating total quantity: ${currentCartQuantity} (in cart) + ${newQuantity} (adding) = ${totalQuantity}, min: ${limits.minLimit}, max: ${limits.maxLimit}`);

    // No longer returning invalid for exceeding limits
    // Instead, return an object with validation information
    return {
      valid: true, // Always valid now - we allow adding to cart
      withinLimits: (limits.minLimit ? totalQuantity >= limits.minLimit : true) &&
        (limits.maxLimit ? totalQuantity <= limits.maxLimit : true),
      totalQuantity: totalQuantity,
      minLimit: limits.minLimit,
      maxLimit: limits.maxLimit,
      message: getLimitMessage(totalQuantity, limits)
    };
  }

  // ADD this new helper function to generate appropriate messages
  function getLimitMessage(quantity, limits) {
    if (!limits) return null;

    if (limits.minLimit && quantity < limits.minLimit) {
      return `Minimum order quantity is ${limits.minLimit}. You currently have ${quantity} in your cart.`;
    }

    if (limits.maxLimit && quantity > limits.maxLimit) {
      return `Maximum order quantity is ${limits.maxLimit}. You currently have ${quantity} in your cart.`;
    }

    return null;
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
    try {
      const timestamp = new Date().getTime();
      const shopParam = window.Shopify?.shop || window.location.hostname;
  
      // Try both URL formats in parallel
      const url1 = `${APP_PROXY_PATH}?path=product-limits-${productId}&shop=${shopParam}&t=${timestamp}`;
      const url2 = `${APP_PROXY_PATH}/product-limits/${productId}?shop=${shopParam}&t=${timestamp}`;
  
      const requestOptions = {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      };
  
      // Make both requests in parallel - leveraging Promise.allSettled to handle failures gracefully
      const responses = await Promise.allSettled([
        fetch(url1, requestOptions),
        fetch(url2, requestOptions)
      ]);
  
      // Process responses in order
      for (const response of responses) {
        if (response.status === 'fulfilled' && response.value.ok) {
          const contentType = response.value.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            try {
              const data = await response.value.json();
              if (data && (data.minLimit !== undefined || data.maxLimit !== undefined)) {
                return data;
              }
            } catch (e) {
              // Continue to next response on error
              debugLog('JSON parse error for response:', e);
            }
          }
        }
      }
  
      // If no valid responses, return null to keep checkout disabled
      return null;
    } catch (error) {
      console.error('Fetch error in fetchOrderLimits:', error);
      return null;
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

  // Add this function to your orderLimitValidator.js file to handle cart UI
  function setupCartPageInterception() {
    debugLog('Setting up cart page interception');

    // Function to find quantity inputs on the cart page
    function findCartQuantityInputs() {
      // Different themes use different selectors, so we try multiple
      const possibleSelectors = [
        'input[name^="updates"]',                   // Standard cart quantity inputs
        '.cart__quantity-input',                    // Some themes
        '.cart-item-quantity-wrapper input',        // Other themes
        '.quantity-selector__input',                // Yet other themes
        '[data-quantity-input]',                    // Data attribute based
        'input[id^="Quantity-"]',                   // Theme specific
        '.js-qty__input',                           // JS targeted inputs
        '.cart__qty-input'                          // Another common class
      ];

      // Try all these selectors
      for (const selector of possibleSelectors) {
        const inputs = document.querySelectorAll(selector);
        if (inputs.length > 0) {
          debugLog(`Found ${inputs.length} quantity inputs using selector: ${selector}`);
          return inputs;
        }
      }

      debugLog('Could not find cart quantity inputs');
      return [];
    }

    // Add event listeners to quantity inputs, but don't prevent changes
    // Just update UI after changes
    const inputs = findCartQuantityInputs();

    inputs.forEach(input => {
      ['change', 'input'].forEach(eventType => {
        input.addEventListener(eventType, function() {
          // After a short delay, update checkout buttons
          requestAnimationFrame(() => {
            checkCurrentCart().then(() => {
              updateCheckoutButtonsState();
            });
          });
        });
      });
    });

    // Function to find quantity buttons (increase/decrease)
    function findCartQuantityButtons() {
      const possibleSelectors = [
        // Increase buttons
        '[data-quantity-input-up], .js-qty__adjust--plus, .cart__qty-increase, .quantity-up, .plus, [data-action="increase-quantity"]',
        // Decrease buttons
        '[data-quantity-input-down], .js-qty__adjust--minus, .cart__qty-decrease, .quantity-down, .minus, [data-action="decrease-quantity"]'
      ];

      let buttons = [];
      for (const selector of possibleSelectors) {
        const foundButtons = document.querySelectorAll(selector);
        if (foundButtons.length > 0) {
          debugLog(`Found ${foundButtons.length} quantity buttons using selector: ${selector}`);
          buttons = [...buttons, ...foundButtons];
        }
      }

      return buttons;
    }

    // Cache the product ID we're monitoring
    const productId = getProductId();
    if (!productId) {
      debugLog('No product ID to monitor on this page');
      return;
    }

    // Function to intercept direct input changes
    function interceptQuantityInputs() {
      const inputs = findCartQuantityInputs();

      inputs.forEach(input => {
        // Store original value to restore if invalid
        input.dataset.lastValidValue = input.value;

        // Add event listeners
        ['change', 'input'].forEach(eventType => {
          input.addEventListener(eventType, function(e) {
            const newValue = parseInt(this.value, 10);
            if (isNaN(newValue)) return;

            // Try to find the cart item this belongs to
            const cartItem = this.closest('.cart-item, .cart__item, .cart__row, [data-cart-item]');
            if (!cartItem) return;

            // Try to extract the product ID from the cart item
            // This is tricky as different themes store it differently
            let itemProductId = null;

            // Try data attribute
            itemProductId = cartItem.dataset.productId || cartItem.dataset.id;

            // Try URL in a link
            if (!itemProductId) {
              const productLink = cartItem.querySelector('a[href*="/products/"]');
              if (productLink) {
                const productUrl = productLink.getAttribute('href');
                // Extract the handle and query the page
                // This is approximate as we can't reliably get the product ID from the handle
                debugLog('Found product URL:', productUrl);
              }
            }

            debugLog('Cart item product ID:', itemProductId, 'Monitoring product ID:', productId);

            // If this is our monitored product (or we couldn't determine), validate
            if (!itemProductId || itemProductId === productId) {
              debugLog(`Validating cart quantity change: ${newValue}, max: ${productLimits?.maxLimit}`);

              if (productLimits && newValue > productLimits.maxLimit) {
                console.warn(`Prevented quantity change: ${newValue} exceeds max ${productLimits.maxLimit}`);

                // Reset the input value to last valid value
                this.value = this.dataset.lastValidValue;

                // Show error message
                displayCartErrorMessage(`Maximum order quantity is ${productLimits.maxLimit}`);

                // Prevent default and stop propagation
                e.preventDefault();
                e.stopPropagation();
                return false;
              } else {
                // Store new valid value
                this.dataset.lastValidValue = newValue;
              }
            }
          }, true);
        });
      });
    }

    // Function to intercept quantity buttons
    function interceptQuantityButtons() {
      const buttons = findCartQuantityButtons();

      buttons.forEach(button => {
        button.addEventListener('click', function(e) {
          // Try to find the associated input
          const cartItem = this.closest('.cart-item, .cart__item, .cart__row, [data-cart-item]');
          if (!cartItem) return;

          const input = cartItem.querySelector('input[name^="updates"], .cart__quantity-input, input[id^="Quantity-"]');
          if (!input) return;

          const currentValue = parseInt(input.value, 10);
          if (isNaN(currentValue)) return;

          // Determine if this is increase or decrease
          const isIncrease = this.classList.contains('js-qty__adjust--plus') ||
            this.classList.contains('cart__qty-increase') ||
            this.classList.contains('quantity-up') ||
            this.classList.contains('plus') ||
            this.hasAttribute('data-quantity-input-up') ||
            this.getAttribute('data-action') === 'increase-quantity';

          const newValue = isIncrease ? currentValue + 1 : currentValue - 1;

          // Try to extract the product ID from the cart item
          let itemProductId = cartItem.dataset.productId || cartItem.dataset.id;

          // If this is our monitored product (or we couldn't determine), validate
          if (!itemProductId || itemProductId === productId) {
            debugLog(`Validating quantity button ${isIncrease ? 'increase' : 'decrease'}: ${newValue}, max: ${productLimits?.maxLimit}`);

            if (productLimits && isIncrease && newValue > productLimits.maxLimit) {
              console.warn(`Prevented quantity button: ${newValue} exceeds max ${productLimits.maxLimit}`);

              // Show error message
              displayCartErrorMessage(`Maximum order quantity is ${productLimits.maxLimit}`);

              // Prevent default and stop propagation
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
        }, true);
      });
    }

    // Run interception setup
    requestAnimationFrame(() => {
      interceptQuantityInputs();
      interceptQuantityButtons();

      // Set up a mutation observer to catch dynamically added elements
      const observer = new MutationObserver(mutations => {
        let shouldRecheck = false;

        // Check if we need to re-run our interception
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1 && (
                node.classList.contains('cart-item') ||
                node.classList.contains('cart__item') ||
                node.classList.contains('cart__row') ||
                node.hasAttribute('data-cart-item')
              )) {
                shouldRecheck = true;
                break;
              }
            }
          }
        });

        if (shouldRecheck) {
          debugLog('Cart contents changed, re-running interception');
          interceptQuantityInputs();
          interceptQuantityButtons();
        }
      });

      // Start observing the cart container
      const cartContainer = document.querySelector('.cart, #cart, [data-section-type="cart"], .cart-wrapper');
      if (cartContainer) {
        observer.observe(cartContainer, { childList: true, subtree: true });
      }
    }); // Small delay to ensure elements are loaded
  }



  // ADD these new functions
  // Function to update all checkout buttons based on current cart state
  async function updateCheckoutButtonsState() {
    // Don't re-check cart if this is the initial page load validation
    // (we've already checked it in initializeValidation)
    if (!document.querySelector('.limit-initial-disabled')) {
      await checkCurrentCart();
    } else {
      // Remove the initial disabled class since we're processing for real now
      document.querySelectorAll('.limit-initial-disabled').forEach(button => {
        button.classList.remove('limit-initial-disabled');
      });
    }
  
    // Record time of this update
    const now = Date.now();
    if (now - lastButtonStateUpdate < BUTTON_UPDATE_COOLDOWN) {
      // If we've updated recently, schedule another update
      if (!pendingValidation) {
        pendingValidation = true;
        setTimeout(() => {
          pendingValidation = false;
          updateCheckoutButtonsState();
        }, BUTTON_UPDATE_COOLDOWN);
      }
      return; // Skip this update
    }
    
    lastButtonStateUpdate = now;
    
    try {
      if (!productLimits) {
        // If we don't have limits, keep buttons disabled as a safety measure
        debugLog('No product limits available, keeping checkout disabled for safety');
        return;
      }
  
      // Validate the current quantity against limits
      const validationResult = validateTotalQuantity(0, productLimits); // 0 because we're checking current cart only
  
      // Find all checkout buttons
      const checkoutButtons = findCheckoutButtons();
      debugLog(`Found ${checkoutButtons.length} checkout buttons for state update`);
  
      if (!validationResult.withinLimits) {
        // Limits not met, ensure buttons stay disabled
        checkoutButtons.forEach(button => {
          // Save original state if we haven't already
          if (!button.hasAttribute('data-original-disabled')) {
            button.setAttribute('data-original-disabled', button.disabled || false);
            button.setAttribute('data-original-opacity', button.style.opacity || '');
            button.setAttribute('data-original-pointer-events', button.style.pointerEvents || '');
            button.setAttribute('data-original-cursor', button.style.cursor || '');
          }
  
          // Keep button disabled
          button.disabled = true;
          button.style.opacity = '0.5';
          button.style.pointerEvents = 'none';
          button.style.cursor = 'not-allowed';
          button.classList.add('limit-disabled');
  
          // Add warning to innerHTML if possible
          if (!button.querySelector('.limit-warning-text')) {
            try {
              const warningSpan = document.createElement('span');
              warningSpan.className = 'limit-warning-text';
              warningSpan.style.marginLeft = '5px';
              warningSpan.style.fontSize = '80%';
              warningSpan.innerHTML = '⚠️';
              button.appendChild(warningSpan);
            } catch (e) {
              // Ignore errors adding warning text
            }
          }
        });
  
        // Show warning message
        showLimitWarning(validationResult.message);
      } else {
        // Limits met, restore buttons to original state
        checkoutButtons.forEach(button => {
          if (button.hasAttribute('data-original-disabled')) {
            // Only restore if we previously saved state
            const wasDisabled = button.getAttribute('data-original-disabled') === 'true';
            button.disabled = wasDisabled;
            button.style.opacity = button.getAttribute('data-original-opacity');
            button.style.pointerEvents = button.getAttribute('data-original-pointer-events');
            button.style.cursor = button.getAttribute('data-original-cursor');
            button.classList.remove('limit-disabled');
            
            // Remove warning text if it exists
            const warningText = button.querySelector('.limit-warning-text');
            if (warningText) {
              button.removeChild(warningText);
            }
  
            // Only remove data attributes if we're truly re-enabling
            if (!wasDisabled) {
              button.removeAttribute('data-original-disabled');
              button.removeAttribute('data-original-opacity');
              button.removeAttribute('data-original-pointer-events');
              button.removeAttribute('data-original-cursor');
            }
          } else {
            // This is a button that was preemptively disabled
            button.disabled = false;
            button.style.opacity = '';
            button.style.pointerEvents = '';
            button.style.cursor = '';
            button.classList.remove('limit-disabled');
          }
        });
  
        // Clear warning
        clearLimitWarning();
      }
    } catch (error) {
      console.error('Error updating checkout button state:', error);
      // In case of error, ensure buttons stay disabled as a safety measure
    } finally {
      // Mark validation as complete
      validationInProgress = false;
      
      // Clear safety timer
      if (disableCheckoutTimer) {
        clearTimeout(disableCheckoutTimer);
        disableCheckoutTimer = null;
      }
    }
  }
  

  // Function to find all checkout buttons
  function findCheckoutButtons() {
    // Different themes use different selectors for checkout buttons
    const checkoutSelectors = [
      // Standard checkout buttons
      'button[name="checkout"]',
      'input[name="checkout"]',
      'a[href="/checkout"]',
      // More general selectors
      '.checkout-button',
      '#checkout',
      '.cart__submit-controls [type="submit"]',
      '.cart__submit',
      // Theme-specific selectors
      '.cart__checkout',
      '.cart__submit-button',
      'form[action="/cart"] [type="submit"]',
      'form[action="/checkout"] [type="submit"]',
      // Button with content
      'button:contains("Checkout")',
      'a:contains("Checkout")',
      'input[value="Checkout"]',
      // Dynamic checkout buttons (e.g., Shop Pay, PayPal)
      '.shopify-payment-button__button',
      '.additional-checkout-buttons button',
      '.additional-checkout-buttons a'
    ];

    let buttons = [];
    for (const selector of checkoutSelectors) {
      try {
        const found = document.querySelectorAll(selector);
        if (found && found.length) {
          buttons = [...buttons, ...found];
        }
      } catch (e) {
        // Some selectors might not be valid in all contexts
      }
    }

    return buttons;
  }

  // Function to show limit warning
  function showLimitWarning(message) {
    // Try to find an existing warning container
    let warningContainer = document.querySelector('.order-limit-warning');

    if (!warningContainer) {
      // Create a new warning container
      warningContainer = document.createElement('div');
      warningContainer.className = 'order-limit-warning';
      warningContainer.style.color = '#d14836';
      warningContainer.style.backgroundColor = '#fff8f8';
      warningContainer.style.padding = '10px';
      warningContainer.style.marginTop = '15px';
      warningContainer.style.marginBottom = '15px';
      warningContainer.style.borderRadius = '4px';
      warningContainer.style.border = '1px solid #fadbd7';
      warningContainer.style.fontSize = '14px';
      warningContainer.style.fontWeight = 'bold';

      // Try to insert it in the cart
      const cartForms = document.querySelectorAll('form[action="/cart"], form[action="/cart/update"]');
      let inserted = false;

      if (cartForms.length > 0) {
        // Insert before checkout buttons or at the end of the form
        const form = cartForms[0];
        const checkoutContainer = form.querySelector('.cart__submit-controls, .cart__buttons-container');

        if (checkoutContainer) {
          checkoutContainer.parentNode.insertBefore(warningContainer, checkoutContainer);
          inserted = true;
        } else {
          form.appendChild(warningContainer);
          inserted = true;
        }
      }

      // If we couldn't find a cart form, try other common cart containers
      if (!inserted) {
        const cartContainers = document.querySelectorAll('.cart, #cart, [data-section-type="cart"]');
        if (cartContainers.length > 0) {
          const container = cartContainers[0];
          // Try to find a good placement - before checkout or at the end
          const checkoutContainer = container.querySelector('.cart__submit-controls, .cart__buttons-container');

          if (checkoutContainer) {
            checkoutContainer.parentNode.insertBefore(warningContainer, checkoutContainer);
          } else {
            container.appendChild(warningContainer);
          }
        } else {
          // Last resort - add to body
          document.body.appendChild(warningContainer);
        }
      }
    }

    // Update the warning message
    warningContainer.innerHTML = `
    <div style="display: flex; align-items: center;">
      <div style="margin-right: 10px; font-size: 24px;">⚠️</div>
      <div>${message}</div>
    </div>
    <div style="margin-top: 5px; font-size: 12px; font-weight: normal;">
      Please adjust your quantities to proceed with checkout.
    </div>
  `;

    warningContainer.style.display = 'block';
  }

  // Function to clear limit warning
  function clearLimitWarning() {
    const warningContainer = document.querySelector('.order-limit-warning');
    if (warningContainer) {
      warningContainer.style.display = 'none';
    }
  }

  // Add XMLHttpRequest interception for cart updates
  // Add XMLHttpRequest interception for cart updates
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url) {
  this._orderLimitUrl = url;
  originalXHROpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function(body) {
  // Check if this is a cart-related request (add, update, change, clear)
  if (typeof this._orderLimitUrl === 'string' && 
      (this._orderLimitUrl.includes('/cart/add') || 
       this._orderLimitUrl.includes('/cart/update') ||
       this._orderLimitUrl.includes('/cart/change') ||
       this._orderLimitUrl.includes('/cart/clear'))) {
    debugLog(`Intercepted XHR cart request: ${this._orderLimitUrl}`);
    
    // Immediately disable checkout buttons BEFORE the request completes
    immediatelyDisableCheckoutButtons();

    try {
      // Add readystatechange handler to update buttons after request completes
      this.addEventListener('readystatechange', function() {
        if (this.readyState === 4) {
          debugLog('XHR request completed, refreshing validation');
          // Use setTimeout to ensure this runs after any immediate DOM updates
          setTimeout(() => {
            checkCurrentCart().then(() => updateCheckoutButtonsState());
          }, 100);
        }
      });
    } catch (error) {
      console.error('Error setting up XHR interceptor:', error);
    }
  }

  originalXHRSend.apply(this, arguments);
};

// Add fetch interception for cart updates
const originalFetchForCart = window.fetch;
window.fetch = function(...args) {
  const [url, options] = args;
  if (typeof url === 'string' && 
      (url.includes('/cart/add') || 
       url.includes('/cart/update') ||
       url.includes('/cart/change') ||
       url.includes('/cart/clear'))) {
    debugLog(`Intercepted fetch cart request: ${url}`);
    
    // Immediately disable checkout buttons BEFORE the request completes
    immediatelyDisableCheckoutButtons();

    // Call original fetch but handle the response
    return originalFetchForCart.apply(this, args)
      .then(response => {
        // Schedule validation to run after fetch completes
        setTimeout(() => {
          checkCurrentCart().then(() => updateCheckoutButtonsState());
        }, 100);
        return response;
      });
  }
  return originalFetchForCart.apply(this, args);
};

// Setup observers for quantity inputs to immediately disable checkout on changes
function setupQuantityInputObservers() {
  // Find quantity inputs on product page
  const quantityInputs = document.querySelectorAll('input[name="quantity"], [aria-label="Quantity"], .quantity-input, .quantity-selector, .js-qty__input');
  
  for (const input of quantityInputs) {
    ['change', 'input', 'keyup', 'mouseup'].forEach(event => {
      input.addEventListener(event, () => {
        // Immediately disable checkout buttons on ANY quantity change
        debugLog('Quantity input changed, immediately disabling checkout');
        immediatelyDisableCheckoutButtons();
        
        // Schedule validation after a short delay to let the DOM update
        setTimeout(() => {
          checkCurrentCart().then(() => updateCheckoutButtonsState());
        }, 100);
      });
    });
  }
  
  // Also find all quantity adjustment buttons (+/- controls)
  const quantityButtons = document.querySelectorAll('.quantity-adjust, .js-qty__adjust, .quantity-button, [data-action="increase-quantity"], [data-action="decrease-quantity"]');
  
  for (const button of quantityButtons) {
    button.addEventListener('click', () => {
      // Immediately disable checkout buttons on ANY quantity change
      debugLog('Quantity button clicked, immediately disabling checkout');
      immediatelyDisableCheckoutButtons();
      
      // Schedule validation after a short delay to let the DOM update
      setTimeout(() => {
        checkCurrentCart().then(() => updateCheckoutButtonsState());
      }, 100);
    });
  }
  
  debugLog(`Set up observers on ${quantityInputs.length} quantity inputs and ${quantityButtons.length} quantity buttons`);
}


async function initializeValidation() {
  const productId = getProductId();
  if (!productId) {
    debugLog('Not on a product page or could not determine product ID');
    // Re-enable any initially disabled buttons
    document.querySelectorAll('[data-limit-preemptive-disabled="true"]').forEach(button => {
      button.disabled = false;
      button.style.opacity = '';
      button.style.pointerEvents = '';
      button.removeAttribute('data-limit-preemptive-disabled');
    });
    return;
  }

  // Start by immediately disabling all checkout buttons
  const buttons = immediatelyDisableCheckoutButtons();
  buttons.forEach(button => {
    button.classList.add('limit-initial-disabled');
  });
  
  debugLog(`Initially disabled ${buttons.length} checkout buttons while validating`);

  try {
    // Start both operations in parallel - this is key for optimization
    const cartPromise = checkCurrentCart();
    const limitsPromise = fetchOrderLimits(productId);
  
    // Wait for both operations to complete in parallel
    const [_, limits] = await Promise.all([cartPromise, limitsPromise]);
    
    productLimits = limits;
  
    if (!limits) {
      debugLog('No limits could be retrieved, keeping checkout disabled for safety');
      // Keep checkout buttons disabled as a safety measure
      return;
    }
  
    // Now update checkout buttons state based on actual data
    await updateCheckoutButtonsState();
  
    // Set up additional observers for cart updates and dynamic checkout buttons
    setupCartUpdateObserver();
    setupCheckoutButtonObserver();
    
    // Add quantity input change interceptors
    setupQuantityInputObservers();
    
    // Special setup for cart page
    const onCartPage = window.location.pathname.includes('/cart');
    if (onCartPage) {
      setupCartPageInterception();
    }
  
    debugLog('Order limit validation fully initialized for product', productId);
  } catch (error) {
    console.error('Error during validation initialization:', error);
    // In case of error, keep buttons disabled as a safety measure
  }

  setupSafetyChecks();

}


  // ADD this new function
  function setupCartUpdateObserver() {
    const cartObserver = new MutationObserver(mutations => {
      let cartUpdated = false;
  
      // Check if any mutation potentially affects the cart
      for (const mutation of mutations) {
        // If any DOM change occurs, immediately disable checkout
        if (mutation.type === 'childList') {
          // If new nodes were added
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // If it's an element
              cartUpdated = true;
              break;
            }
          }
          // If nodes were removed (item removed from cart)
          if (!cartUpdated && mutation.removedNodes.length > 0) {
            for (const node of mutation.removedNodes) {
              if (node.nodeType === 1) { // If it's an element
                cartUpdated = true;
                break;
              }
            }
          }
        } else if (mutation.type === 'attributes') {
          // If an attribute changed on a quantity input or other relevant element
          if (
            mutation.target.name && 
            (mutation.target.name.includes('quantity') || 
             mutation.target.name.includes('updates')) ||
            mutation.target.classList && 
            (mutation.target.classList.contains('quantity-input') ||
             mutation.target.classList.contains('js-qty__input'))
          ) {
            cartUpdated = true;
          }
        }
        
        if (cartUpdated) break;
      }
  
      if (cartUpdated) {
        debugLog('Cart content changed, immediately disabling checkout');
        // Immediately disable checkout buttons
        immediatelyDisableCheckoutButtons();
        
        // Then schedule a validation after a short delay
        setTimeout(() => {
          checkCurrentCart().then(() => updateCheckoutButtonsState());
        }, 150); // Slightly longer delay to ensure DOM is fully updated
      }
    });
  
    // Observe the entire cart section with all options
    const cartContainers = [
      '.cart', 
      '#cart', 
      '[data-section-type="cart"]', 
      'form[action="/cart"]',
      '.cart__items',
      '.cart-items',
      '.cart-wrapper'
    ];
    
    for (const selector of cartContainers) {
      const containers = document.querySelectorAll(selector);
      containers.forEach(container => {
        if (container) {
          cartObserver.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
        }
      });
    }
    
    // If we couldn't find any specific container, observe the body as fallback
    if (document.querySelectorAll(cartContainers.join(',')).length === 0) {
      debugLog('No cart container found, observing body as fallback');
      cartObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    }
    
    debugLog('Cart observer set up');
  }
  
  // ADD this new function
  function setupCheckoutButtonObserver() {
    const checkoutObserver = new MutationObserver(mutations => {
      let checkoutButtonsAdded = false;
      let dynamicButtonsContainer = null;
      
      // Look for added checkout buttons or their containers
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue; // Skip non-element nodes
            
            // Check if this is a checkout button or contains one
            if (
              (node.name === 'checkout' || node.getAttribute && node.getAttribute('name') === 'checkout') ||
              (node.tagName === 'BUTTON' && node.textContent && node.textContent.toLowerCase().includes('checkout')) ||
              (node.href && node.href.includes('/checkout')) ||
              (node.classList && (
                node.classList.contains('checkout-button') ||
                node.classList.contains('cart__submit') ||
                node.classList.contains('shopify-payment-button')
              ))
            ) {
              checkoutButtonsAdded = true;
              break;
            }
            
            // Check if this is a container that might have checkout buttons
            if (node.classList && (
              node.classList.contains('shopify-payment-button') ||
              node.classList.contains('additional-checkout-buttons') ||
              node.classList.contains('cart__submit-controls')
            )) {
              dynamicButtonsContainer = node;
            }
            
            // Check if this element contains any checkout buttons
            if (node.querySelector) {
              const containsCheckoutButton = node.querySelector(
                'button[name="checkout"], input[name="checkout"], .shopify-payment-button__button, ' +
                'a[href="/checkout"], .cart__checkout, #checkout, .checkout-button'
              );
              
              if (containsCheckoutButton) {
                checkoutButtonsAdded = true;
                break;
              }
            }
          }
          
          if (checkoutButtonsAdded) break;
        }
      }
  
      if (checkoutButtonsAdded || dynamicButtonsContainer) {
        debugLog('New checkout buttons detected, immediately disabling them');
        
        // If we found new buttons, immediately disable them
        immediatelyDisableCheckoutButtons();
        
        // Then re-run button state update based on current validation
        setTimeout(() => {
          updateCheckoutButtonsState();
        }, 50);
        
        // If we found a dynamic container that might add buttons later,
        // observe it separately with higher priority
        if (dynamicButtonsContainer) {
          const dynamicObserver = new MutationObserver(() => {
            debugLog('Change in dynamic checkout button container');
            immediatelyDisableCheckoutButtons();
            
            // Update state after a short delay
            setTimeout(() => updateCheckoutButtonsState(), 50);
          });
          
          dynamicObserver.observe(dynamicButtonsContainer, {
            childList: true,
            subtree: true,
            attributes: false
          });
          
          debugLog('Set up specialized observer for dynamic checkout buttons container');
        }
      }
    });
  
    // Observe the whole document for new checkout buttons
    checkoutObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    debugLog('Checkout button observer set up');
  }
  

  if (document.readyState === 'loading') {
    // Start immediately but also ensure it runs after content loads
    initializeValidation();
    document.addEventListener('DOMContentLoaded', function() {
      // Make sure all buttons are found and properly set up
      updateCheckoutButtonsState();
    });
  } else {
    initializeValidation();
  }

  // Re-validate on page show (when coming back to the page)
  window.addEventListener('pageshow', (event) => {
    // If the page is loaded from cache (back button), re-validate
    if (event.persisted) {
      debugLog('Page loaded from cache, re-validating');
      immediatelyDisableCheckoutButtons();
      checkCurrentCart().then(() => updateCheckoutButtonsState());
    }
  });
  
  // Re-validate on visibility change (tab becomes visible again)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      debugLog('Page became visible, re-validating');
      immediatelyDisableCheckoutButtons();
      checkCurrentCart().then(() => updateCheckoutButtonsState());
    }
  });
  
  // Catch any form submissions to /cart/add
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form && form.action && form.action.includes('/cart/add')) {
      debugLog('Intercepted form submission to /cart/add');
      immediatelyDisableCheckoutButtons();
      // Let the form submission happen, but ensure validation happens after
      setTimeout(() => {
        checkCurrentCart().then(() => updateCheckoutButtonsState());
      }, 100);
    }
  });
})();


// Set up a recurring safety check to catch any edge cases
// Set up a recurring safety check to catch any edge cases
// Set up a recurring safety check to catch any edge cases
function setupSafetyChecks() {
  // Store interval ID so we can clear it if needed
  let safetyInterval = null;
  
  // Perform an immediate check with proper scope handling
  const safetyCheck = () => {
    // First, verify that we're in a properly initialized state
    try {
      // Check if productLimits variable exists in the global scope
      if (typeof productLimits === 'undefined' || productLimits === null) {
        debugLog('Safety check: productLimits not available yet, skipping check');
        return;
      }
      
      // Verify that we have a product ID to work with
      const currentProductId = getProductId();
      if (!currentProductId) {
        debugLog('Safety check: No product ID available, skipping check');
        return;
      }
      
      // Verify all checkout buttons have correct state
      const checkoutButtons = findCheckoutButtons();
      if (!checkoutButtons || checkoutButtons.length === 0) {
        // No checkout buttons found, nothing to check
        return;
      }
      
      // Try to get current validation status - use try/catch in case validateTotalQuantity fails
      let validationResult;
      try {
        validationResult = validateTotalQuantity(0, productLimits);
      } catch (validationError) {
        console.error('Error in validation during safety check:', validationError);
        // If validation fails, disable buttons as a precaution
        checkoutButtons.forEach(button => {
          if (!button.disabled) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.pointerEvents = 'none';
          }
        });
        return;
      }
      
      // If validation succeeded but shows limits are not met, ensure buttons are disabled
      if (validationResult && !validationResult.withinLimits) {
        let foundEnabledButtons = false;
        
        checkoutButtons.forEach(button => {
          if (!button.disabled) {
            debugLog('Safety check: Found enabled checkout button when it should be disabled');
            foundEnabledButtons = true;
            
            // Disable it immediately
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.pointerEvents = 'none';
            button.style.cursor = 'not-allowed';
            button.classList.add('limit-disabled');
          }
        });
        
        if (foundEnabledButtons) {
          // Re-run full validation if we found any enabled buttons that should be disabled
          try {
            requestAnimationFrame(() => {
              checkCurrentCart().then(() => updateCheckoutButtonsState());
            });
          } catch (refreshError) {
            console.error('Error refreshing validation:', refreshError);
          }
        }
      }
    } catch (error) {
      // Add error handling to prevent any crashes in the safety check
      console.error('Unexpected error in safety check:', error);
      
      // If we get repeated errors, eventually clear the interval
      if (window.safetyCheckErrorCount === undefined) {
        window.safetyCheckErrorCount = 1;
      } else {
        window.safetyCheckErrorCount++;
      }
      
      // If we've had too many errors, stop the safety checks
      if (window.safetyCheckErrorCount > 10 && safetyInterval) {
        clearInterval(safetyInterval);
        console.warn('Disabled safety checks due to repeated errors');
      }
    }
  };
  
  // Start the safety checks with a safeguard delay - give initialization time to complete
  setTimeout(() => {
    safetyInterval = setInterval(safetyCheck, 1000);
    debugLog('Safety check interval started');
  }, 2000);
  
  // Also run it on visibility changes (tab becomes visible)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Wait a short moment to ensure everything is loaded
      setTimeout(safetyCheck, 200);
    }
  });
  
  // Run it on scroll end (user might scroll to checkout buttons)
  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(safetyCheck, 200);
  });
  
  debugLog('Safety check system initialized');
}
