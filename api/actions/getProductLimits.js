// api/actions/getProductLimits.js
export const run = async ({ params, logger, api }) => {
  try {
    const { productId } = params;
    
    if (!productId) {
      return { error: "Missing productId parameter" };
    }
    
    // Convert string productId to number for database query
    const numericId = Number(productId);
    
    // Fetch the OrderLimit record for this product
    const orderLimit = await api.OrderLimit.maybeFindFirst({
      filter: {
        productId: { equals: numericId }
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
