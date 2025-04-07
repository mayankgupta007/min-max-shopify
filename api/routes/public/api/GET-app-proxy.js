// api/routes/public/api/GET-app-proxy.js
export default async function route({ request, reply, api, logger }) {
  // CRUCIAL: Set response type to JSON immediately
  reply.type('application/json');
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  // Log all details for debugging
  logger.info("App Proxy API Request Received", {
    url: request.url,
    query: request.query,
    headers: request.headers,
    path: request.path || request.raw?.url
  });
  
  // Special handling for Shopify HMAC signature (debug only)
  if (request.query.signature) {
    logger.info("Detected Shopify signature parameter", {
      signature: request.query.signature
    });
  } else {
    logger.info("No signature parameter found");
  }
  
  // Extract path from query parameters
  const path = request.query.path || '';
  const shop = request.query.shop;
  
  // Check if this is a product limits request
  const productLimitsMatch = path.match(/product-limits-(\d+)/);
  if (productLimitsMatch && productLimitsMatch[1]) {
    const productId = productLimitsMatch[1];
    logger.info(`Product limits request for product ID: ${productId}`);
    
    try {
      // Convert the productId to a number
      const numericProductId = Number(productId);
      
      if (isNaN(numericProductId)) {
        logger.warn(`Invalid product ID format: "${productId}"`);
        return {
          success: false,
          error: "Invalid product ID. Must be a number.",
          receivedValue: productId
        };
      }
      
      // Try to fetch the order limit
      logger.info(`Attempting to find OrderLimit for productId: ${numericProductId}`);
      const orderLimit = await api.OrderLimit.findFirst({
        filter: {
          productId: { equals: numericProductId }
        }
      });
      
      if (orderLimit) {
        logger.info(`Found order limit for product ${productId}`, {
          orderId: orderLimit.id,
          minLimit: orderLimit.minLimit,
          maxLimit: orderLimit.maxLimit,
          productName: orderLimit.productName
        });
        
        return {
          success: true,
          minLimit: orderLimit.minLimit,
          maxLimit: orderLimit.maxLimit,
          productId: numericProductId,
          productName: orderLimit.productName || `Product ${productId}`,
          message: "Limits found",
          source: "app_proxy_api",
          shop: shop
        };
      } else {
        logger.info(`No order limit found for product ${productId}`);
        
        return {
          success: true,
          minLimit: null,
          maxLimit: null,
          productId: numericProductId,
          productName: null,
          message: "No limits found for this product",
          source: "app_proxy_api",
          shop: shop
        };
      }
    } catch (error) {
      logger.error(`Error processing product limits request: ${error.message}`, {
        error: error.stack,
        productId
      });
      
      return {
        success: false,
        error: "Server error processing request",
        message: `Failed to retrieve order limits: ${error.message}`
      };
    }
  }
    
  // For any other request, respond with detailed information
  return {
    success: true,
    message: "App proxy API endpoint responding",
    timestamp: new Date().toISOString(),
    path: path,
    shop: shop,
    query: request.query,
    requestUrl: request.url,
    // Include additional information to help debug
    pathComponents: path.split('/'),
    pathIncludes: {
      bypassTest: path.includes('bypass-test'),
      productLimits: path.includes('product-limits')
    }
  };
}
