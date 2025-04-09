const DEBUG_MODE = false;

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
        // Add cache: 'no-store' to avoid browser caching
        cache: 'no-store'
      });

      if (response.ok) {
        const cart = await response.json();

        // Get the product ID we're tracking
        const productId = getProductId();
        if (!productId) return 0;

        // Find any matching items in the cart
        let quantity = 0;
        for (const item of cart.items) {
          const itemProductId = item.product_id;
          if (itemProductId == productId) {
            quantity += item.quantity;
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

      // Try both URL formats in parallel instead of sequentially
      const url1 = `${APP_PROXY_PATH}?path=product-limits-${productId}&shop=${shopParam}&t=${timestamp}`;
      const url2 = `${APP_PROXY_PATH}/product-limits/${productId}?shop=${shopParam}&t=${timestamp}`;

      const requestOptions = {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      };

      // Make both requests in parallel
      const [response1, response2] = await Promise.allSettled([
        fetch(url1, requestOptions),
        fetch(url2, requestOptions)
      ]);

      // Try to get data from the first successful response
      let data = null;

      // Check first response
      if (response1.status === 'fulfilled' && response1.value.ok) {
        const resp = response1.value;
        const contentType = resp.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          try {
            data = await resp.json();
            if (data && (data.minLimit !== undefined || data.maxLimit !== undefined)) {
              return data;
            }
          } catch (e) { /* Continue to next attempt */ }
        }
      }

      // Check second response
      if (response2.status === 'fulfilled' && response2.value.ok) {
        const resp = response2.value;
        const contentType = resp.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          try {
            data = await resp.json();
            if (data && (data.minLimit !== undefined || data.maxLimit !== undefined)) {
              return data;
            }
          } catch (e) { /* Continue to fallback */ }
        }
      }

      // Immediately use hardcoded fallback if API calls fail
      return getHardcodedLimits(productId);
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

    if (!productLimits) return;

    // Validate the current quantity against limits
    const validationResult = validateTotalQuantity(0, productLimits); // 0 because we're checking current cart only

    // Find all checkout buttons
    const checkoutButtons = findCheckoutButtons();

    if (!validationResult.withinLimits) {
      // Disable checkout buttons
      checkoutButtons.forEach(button => {
        // Don't store original state if we already have 
        if (!button.hasAttribute('data-original-disabled')) {
          button.setAttribute('data-original-disabled', button.disabled || false);
          button.setAttribute('data-original-style', button.getAttribute('style') || '');
          button.setAttribute('data-original-html', button.innerHTML);
        }

        // Disable and style the button
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        button.style.pointerEvents = 'none';
        button.classList.add('limit-disabled');

        // Add warning to innerHTML if possible
        if (!button.querySelector('.limit-warning-text')) {
          const warningSpan = document.createElement('span');
          warningSpan.className = 'limit-warning-text';
          warningSpan.style.marginLeft = '5px';
          warningSpan.style.fontSize = '80%';
          warningSpan.innerHTML = '⚠️';
          button.appendChild(warningSpan);
        }
      });

      // Show warning message
      showLimitWarning(validationResult.message);
    } else {
      // Re-enable checkout buttons
      checkoutButtons.forEach(button => {
        if (button.hasAttribute('data-original-disabled')) {
          const wasDisabled = button.getAttribute('data-original-disabled') === 'true';
          button.disabled = wasDisabled;
          button.style = button.getAttribute('data-original-style');
          button.innerHTML = button.getAttribute('data-original-html');
          button.classList.remove('limit-disabled');

          // Remove data attributes
          button.removeAttribute('data-original-disabled');
          button.removeAttribute('data-original-style');
          button.removeAttribute('data-original-html');
        } else {
          // This is a button that was initially disabled
          button.disabled = false;
          button.style.opacity = '';
          button.style.cursor = '';
          button.style.pointerEvents = '';
          button.classList.remove('limit-disabled');
        }
      });

      // Clear warning
      clearLimitWarning();
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
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._orderLimitUrl = url;
    originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    // Check if this is a cart/add request
    if (typeof this._orderLimitUrl === 'string' && this._orderLimitUrl.includes('/cart/add')) {
      debugLog('Intercepted XHR cart/add request');

      try {
        // Add readystatechange handler to check results after request completes
        this.addEventListener('readystatechange', function() {
          if (this.readyState === 4) {
            debugLog('XHR request completed, updating checkout state');
            requestAnimationFrame(() => {
              checkCurrentCart().then(() => updateCheckoutButtonsState());
            });
          }
        });
      } catch (error) {
        console.error('Error setting up XHR interceptor:', error);
      }
    }
    // Handle cart/change requests
    else if (typeof this._orderLimitUrl === 'string' && this._orderLimitUrl.includes('/cart/change')) {
      debugLog('Intercepted XHR cart/change request');

      try {
        // Add readystatechange handler to check results after request completes
        this.addEventListener('readystatechange', function() {
          if (this.readyState === 4) {
            debugLog('XHR cart/change completed, updating checkout state');
            requestAnimationFrame(() => {
              checkCurrentCart().then(() => updateCheckoutButtonsState());
            });
          }
        });
      } catch (error) {
        console.error('Error setting up XHR cart/change interceptor:', error);
      }
    }

    originalXHRSend.apply(this, arguments);
  };

  async function initializeValidation() {
    const productId = getProductId();
    if (!productId) {
      debugLog('Not on a product page or could not determine product ID');
      // Re-enable any initially disabled buttons
      document.querySelectorAll('.limit-initial-disabled').forEach(button => {
        button.classList.remove('limit-initial-disabled');
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';
        button.style.pointerEvents = '';
      });
      return;
    }

    // Start both operations in parallel
    const cartPromise = checkCurrentCart();
    const limitsPromise = fetchOrderLimits(productId);

    // Wait for both operations to complete
    const [_, limits] = await Promise.all([cartPromise, limitsPromise]);
    productLimits = limits;

    if (!limits) {
      debugLog('No limits could be retrieved for this product');
      // Re-enable any initially disabled buttons
      document.querySelectorAll('.limit-initial-disabled').forEach(button => {
        button.classList.remove('limit-initial-disabled');
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';
        button.style.pointerEvents = '';
      });
      return;
    }

    // Now update checkout buttons state
    updateCheckoutButtonsState();

    // Check if we're on a cart page
    const onCartPage = window.location.pathname.includes('/cart');
    if (onCartPage) {
      debugLog('On cart page, setting up additional interception');
      setupCartPageInterception();
    }

    // These can happen after the initial validation is complete
    setupCartUpdateObserver();
    setupCheckoutButtonObserver();

    debugLog('Order limit validation initialized for product', productId);
  }


  // ADD this new function
  function setupCartUpdateObserver() {
    const cartObserver = new MutationObserver(mutations => {
      let cartUpdated = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          // Check if cart content might have changed
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
              if (
                node.classList && (
                  node.classList.contains('cart__item') ||
                  node.classList.contains('cart-item') ||
                  node.classList.contains('cart__row')
                ) ||
                node.querySelector && (
                  node.querySelector('.cart__item, .cart-item, .cart__row')
                )
              ) {
                cartUpdated = true;
                break;
              }
            }
          }
        } else if (mutation.type === 'attributes') {
          // If quantity attributes change
          if (mutation.attributeName === 'value' &&
            mutation.target.name &&
            mutation.target.name.includes('quantity')) {
            cartUpdated = true;
          }
        }
      });

      if (cartUpdated) {
        debugLog('Cart content changed, updating checkout buttons');
        requestAnimationFrame(() => updateCheckoutButtonsState());
      }
    });

    // Start observing the cart container
    const cartContainers = document.querySelectorAll('.cart, #cart, [data-section-type="cart"], form[action="/cart"]');
    cartContainers.forEach(container => {
      if (container) {
        cartObserver.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: false
        });
        debugLog('Observing cart container for changes:', container);
      }
    });
  }

  // ADD this new function
  function setupCheckoutButtonObserver() {
    const checkoutObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          // Check if any new checkout buttons were added
          let checkoutButtonAdded = false;

          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
              if (
                (node.name === 'checkout' || node.getAttribute('name') === 'checkout') ||
                (node.href && node.href.includes('/checkout')) ||
                (node.classList && (
                  node.classList.contains('checkout-button') ||
                  node.classList.contains('cart__submit')
                )) ||
                (node.querySelector && node.querySelector('button[name="checkout"], input[name="checkout"]'))
              ) {
                checkoutButtonAdded = true;
                break;
              }
            }
          }

          if (checkoutButtonAdded) {
            debugLog('New checkout button detected, updating state');
            requestAnimationFrame(() => updateCheckoutButtonsState());
          }
        }
      });
    });

    // Observe the whole document for new checkout buttons
    checkoutObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    debugLog('Observing document for new checkout buttons');
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
})();
