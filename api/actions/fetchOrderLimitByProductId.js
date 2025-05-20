// api/actions/fetchOrderLimitByProductId.js
export const run = async ({ params, logger, api, connections, session }) => {
  try {
    // Ensure productId is a number
    const productIdInput = params.productId;
    const productId = typeof productIdInput === 'string' 
      ? parseInt(productIdInput, 10) 
      : productIdInput;
    
    if (isNaN(productId)) {
      logger.warn(`Invalid product ID passed to fetchOrderLimitByProductId: ${productIdInput}`);
      throw new Error(`Invalid product ID: ${productIdInput}`);
    }
    
    // Get the current shop ID for tenant isolation
    // Use the passed shopId if available, otherwise fall back to session
    const shopId = params.shopId || session?.shop?.id || connections.shopify?.currentShopId;
    if (!shopId) {
      logger.warn("No shop ID available in params, session or connections");
      throw new Error("Shop not authenticated");
    }
    
    logger.info(`Searching for OrderLimit with productId: ${productId} for shop: ${shopId}`);
    
    // Use the API to search for an OrderLimit with the matching productId AND shop
    const orderLimit = await api.OrderLimit.maybeFindFirst({
      filter: {
        AND: [
          { productId: { equals: productId } },
          { shop: { id: { equals: shopId } } }
        ]
      }
    });

    // Try to get the product name from Shopify for better user experience
    let productName = orderLimit?.productName || null;
    if (!productName) {
      try {
        // Try to find the product in Shopify
        const shopifyProduct = await api.shopifyProduct.findFirst({
          filter: { id: { equals: String(productId) } },
          select: { title: true }
        });
        
        if (shopifyProduct && shopifyProduct.title) {
          productName = shopifyProduct.title;
          logger.info(`Found product name from Shopify: ${productName}`);
          
          // If we have an orderLimit without a name, update it
          if (orderLimit && !orderLimit.productName) {
            await api.OrderLimit.update(orderLimit.id, { 
              productName: productName 
            });
            logger.info(`Updated OrderLimit ${orderLimit.id} with product name`);
          }
        }
      } catch (productError) {
        logger.warn(`Could not get product name from Shopify: ${productError.message}`);
      }
    }
    
    if (orderLimit) {
      logger.info(`Found OrderLimit record with id: ${orderLimit.id}`);
      return {
        minLimit: orderLimit.minLimit,
        maxLimit: orderLimit.maxLimit,
        productId: productId,
        productName: productName || `Product ${productId}`,
        message: "Limits found"
      };
    } else {
      logger.info(`No OrderLimit found for productId: ${productId} in shop: ${shopId}`);
      // Return a default object with null values
      return {
        minLimit: null,
        maxLimit: null,
        productId: productId,
        productName: productName || `Product ${productId}`,
        message: "No limits found for this product"
      };
    }
  } catch (error) {
    logger.error(`Error fetching OrderLimit by productId: ${error.message}`, { error });
    throw error;
  }
};

export const params = {
  productId: { type: "string" }, // Keep this as string
  shopId: { type: "string", optional: true }
};


export const options = {
  returns: true,
  triggers: { api: true }
};
