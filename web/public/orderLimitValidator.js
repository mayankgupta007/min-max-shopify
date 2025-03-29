// web/public/orderLimitValidator.js
(function() {
  // Configuration - use shopify.theme library if available
  const APP_PROXY_PATH = window.Shopify && window.Shopify.routes ? 
    window.Shopify.routes.root + 'apps/order-limit-app' : '/apps/order-limit-app';

  // Debug mode - set to true to see more detailed console logs
  const DEBUG = false;
  
  function log(message, ...data) {
    if (DEBUG) {
      console.log(`[OrderLimit] ${message}`, ...data);
    }
  }
  
  function warn(message, ...data) {
    console.warn(`[OrderLimit] ${message}`, ...data);
  }
  
  function error(message, ...data) {
    console.error(`[OrderLimit] ${message}`, ...data);
  }
  
  // Support for various theme templates
  const QUANTITY_SELECTORS = [
    '[name="quantity"]',
    '.quantity-input',
    '[data-quantity-input]',
    'input.quantity',
    '.product-form__quantity',
    '#Quantity',
    '#quantity',
    '.js-qty__input',
    '[data-quantity]',
    'input[aria-label*="Quantity"]'
  ];
  
  const ADD_TO_CART_SELECTORS = [
    '[name="add"]',
    '[data-add-to-cart]',
    '.add-to-cart',
    '#AddToCart',
    '.product-form__cart-submit',
    '.add_to_cart',
    '.product-submit',
    '.add-to-cart-button',
    'button:contains("Add to Cart")'
  ];
  
  // Extract product ID from the page with enhanced methods
  function getProductId() {
    // Method 1: From JSON-LD metadata (most reliable)
    const jsonLD = document.querySelector('script[type="application/ld+json"]');
    if (jsonLD) {
      try {
        const data = JSON.parse(jsonLD.textContent);
        if (data && data['@type'] === 'Product' && data.productID) {
          log('Found product ID in JSON-LD:', data.productID);
          return data.productID;
        }
      } catch (e) {
        error('Error parsing JSON-LD:', e);
      }
    }
    
    // Method 2: From product JSON (common in most themes)
    const productJsonScripts = [
      '[id^="ProductJson-"]',
      'script[data-product-json]',
      '#ProductJson'
    ];
    
    for (const selector of productJsonScripts) {
      const productJson = document.querySelector(selector);
      if (productJson) {
        try {
          const productData = JSON.parse(productJson.textContent);
          if (productData && productData.id) {
            log('Found product ID in product JSON:', productData.id);
            return productData.id.toString();
          }
        } catch (e) {
          error('Error parsing product JSON:', e);
        }
      }
    }
    
    // Method 3: From meta tags
    if (typeof meta !== 'undefined' && meta && meta.product && meta.product.id) {
      log('Found product ID in meta object:', meta.product.id);
      return meta.product.id.toString();
    }
    
    // Method 4: From data attributes in the DOM
    const dataAttributes = [
      'form[data-product-id]',
      '[data-product-id]',
      '[data-product]'
    ];
    
    for (const selector of dataAttributes) {
      const element = document.querySelector(selector);
      if (element) {
        const id = element.getAttribute('data-product-id') || element.getAttribute('data-product');
        if (id) {
          log('Found product ID in DOM data attribute:', id);
          return id.toString();
        }
      }
    }
    
    // Method 5: From URL and complementary data
    const match = window.location.pathname.match(/\/products\/([^\/]+)/);
    if (match && match[1]) {
      const urlHandle = match[1];
      log('Found product handle in URL:', urlHandle);
      
      // Look for product ID in variants data
      const variantsSelector = document.querySelector('#product-variants, [data-product-variants]');
      if (variantsSelector) {
        const variantId = variantsSelector.querySelector('[value]:checked, [data-id]');
        if (variantId) {
          const id = variantId.value || variantId.getAttribute('data-id');
          if (id) {
            log('Found variant ID:', id);
            return id.toString();
          }
        }
      }
      
      warn('Only product handle found from URL, not the product ID:', urlHandle);
    }
    
    error('Could not find product ID using any method');
    return null;
  }
  
  // Rest of the file remains similar with updated query selectors and error handling
  // ...

  // Find quantity input with multiple selectors for different themes
  function findQuantityInput() {
    for (const selector of QUANTITY_SELECTORS) {
      const input = document.querySelector(selector);
      if (input) {
        log('Found quantity input with selector:', selector);
        return input;
      }
    }
    return null;
  }
  
  // Find add to cart button with multiple selectors for different themes
  function findAddToCartButton() {
    for (const selector of ADD_TO_CART_SELECTORS) {
      const button = document.querySelector(selector);
      if (button) {
        log('Found add to cart button with selector:', selector);
        return button;
      }
    }
    return null;
  }
  
  // Initialize validation with theme compatibility
  async function initialize() {
    log('Initializing order limit validation');
    
    const productId = getProductId();
    if (!productId) {
      warn('No product ID found, skipping validation');
      return;
    }
    
    log('Checking order limits for product ID:', productId);
    const limits = await fetchOrderLimits(productId);
    
    if (!limits) {
      log('No order limits defined for this product');
      return;
    }
    
    log('Order limits found:', limits);
    
    // Find quantity input - try multiple selectors
    const quantityInput = findQuantityInput();
    if (!quantityInput) {
      warn('Quantity input not found on page, order limits cannot be enforced');
      return;
    }
    
    // Initial validation
    const quantity = parseInt(quantityInput.value) || 1;
    const validation = validateQuantity(quantity, limits);
    updateUI(quantityInput, validation);
    
    // Add event listeners with debouncing
    const debounceTime = 300; // 300ms debounce
    let debounceTimeout;
    
    // Handle various input events
    ['change', 'input', 'keyup'].forEach(eventName => {
      quantityInput.addEventListener(eventName, function() {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          const quantity = parseInt(this.value) || 1;
          const validation = validateQuantity(quantity, limits);
          updateUI(this, validation);
        }, debounceTime);
      });
    });
    
    // Handle quantity adjusters (plus/minus buttons)
    const adjusters = document.querySelectorAll('.quantity-adjuster, [data-quantity-button], .js--qty-adjuster');
    adjusters.forEach(adjuster => {
      adjuster.addEventListener('click', function() {
        setTimeout(() => {
          const quantity = parseInt(quantityInput.value) || 1;
          const validation = validateQuantity(quantity, limits);
          updateUI(quantityInput, validation);
        }, 100); // Short delay to let input value update
      });
    });
    
    // Intercept form submission
    const form = quantityInput.closest('form');
    if (form) {
      log('Adding form submission interceptor');
      form.addEventListener('submit', function(event) {
        const quantity = parseInt(quantityInput.value) || 1;
        const validation = validateQuantity(quantity, limits);
        
        if (!validation.valid) {
          event.preventDefault();
          updateUI(quantityInput, validation);
          // Scroll to the error message
          const errorElement = document.getElementById('order-limit-error');
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }
  }
  
  // Run when DOM is loaded with retry mechanism
  function initWithRetry(retryCount = 0, maxRetries = 3) {
    try {
      initialize();
    } catch (e) {
      error('Error during initialization:', e);
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 500; // Exponential backoff
        setTimeout(() => initWithRetry(retryCount + 1, maxRetries), delay);
      }
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initWithRetry());
  } else {
    initWithRetry();
  }
})();
