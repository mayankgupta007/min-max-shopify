/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections }) => {
  try {
    logger.info(`Searching for OrderLimit with productId: ${params.productId}`);
    
    // Use the API to search for an OrderLimit with the matching productId
    // Since productId is stored as a number in the database, we use a numeric comparison filter
    const orderLimit = await api.OrderLimit.maybeFindFirst({
      filter: {
        productId: { equals: params.productId }
      }
    });
    
    if (orderLimit) {
      logger.info(`Found OrderLimit record with id: ${orderLimit.id}`);
    } else {
      logger.info(`No OrderLimit found for productId: ${params.productId}`);
    }
    
    // Return the found record or null if not found
    return orderLimit;
  } catch (error) {
    logger.error(`Error fetching OrderLimit by productId: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Define the parameter schema for this action
 * 
 * The productId parameter is defined as a number because the OrderLimit model 
 * stores productId as a numeric field. This ensures proper type handling and
 * numeric comparison in the database query.
 */
export const params = {
  productId: { type: "number" }
};

/**
 * Configure the action options
 */
export const options = {
  returns: true,
  triggers: {
    api: true
  }
};