// api/actions/fetchOrderLimitByProductId.js

export const run = async ({ params, logger, api, connections, session }) => {
  try {
    // Ensure productId is a number
    const productId = typeof params.productId === 'string' 
      ? parseInt(params.productId, 10) 
      : params.productId;
    
    if (isNaN(productId)) {
      logger.warn(`Invalid product ID passed to fetchOrderLimitByProductId: ${params.productId}`);
      throw new Error(`Invalid product ID: ${params.productId}`);
    }
    
    // Get the current shop ID for tenant isolation
    const shopId = session?.shop?.id || connections.shopify?.currentShopId;
    if (!shopId) {
      logger.warn("No shop ID available in session or connections");
      throw new Error("Shop not authenticated");
    }
    
    logger.info(`Searching for OrderLimit with productId: ${productId} for shop: ${shopId}`);
    
    // Use the API to search for an OrderLimit with the matching productId AND shop
    const orderLimit = await api.OrderLimit.maybeFindFirst({
      filter: {
        AND: [
          { productId: { equals: productId } },
          { shopId: { equals: shopId } }
        ]
      }
    });
    
    if (orderLimit) {
      logger.info(`Found OrderLimit record with id: ${orderLimit.id}`);
      return {
        minLimit: orderLimit.minLimit,
        maxLimit: orderLimit.maxLimit,
        productId: productId,
        productName: orderLimit.productName || `Product ${productId}`,
        message: "Limits found"
      };
    } else {
      logger.info(`No OrderLimit found for productId: ${productId} in shop: ${shopId}`);
      // Return a default object with null values
      return {
        minLimit: null,
        maxLimit: null,
        productId: productId,
        productName: null,
        message: "No limits found for this product"
      };
    }
  } catch (error) {
    logger.error(`Error fetching OrderLimit by productId: ${error.message}`, { error });
    throw error;
  }
};
