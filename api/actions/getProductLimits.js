// api/actions/getProductLimits.js
export const run = async ({ params, logger, api, session, connections }) => {
  try {
    const { productId } = params;
    
    if (!productId) {
      return { error: "Missing productId parameter" };
    }
    
    // Get the current shop ID for tenant isolation
    const shopId = session?.shop?.id || connections.shopify?.currentShopId;
    if (!shopId) {
      logger.warn("No shop ID available in session or connections");
      return { error: "Shop not authenticated" };
    }
    
    // Convert string productId to number for database query
    const numericId = Number(productId);
    
    // Fetch the OrderLimit record for this product WITH shop filter
    const orderLimit = await api.OrderLimit.maybeFindFirst({
      filter: {
        AND: [
          { productId: { equals: numericId } },
          { shop: { id: { equals: shopId } } } // Correct shop relationship filter
        ]
      }
    });
    
    // Return the order limits
    return orderLimit ? {
      minLimit: orderLimit.minLimit,
      maxLimit: orderLimit.maxLimit
    } : null;
    
  } catch (error) {
    logger.error(`Error fetching product limits: ${error.message}`, { error });
    throw new Error("Internal server error");
  }
};

export const params = {
  productId: { type: "string" }
};

export const options = {
  returns: true,
  triggers: {
    api: true
  }
};
