/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections }) => {
  // Extract parameters - productId is now expected to be a number
  const { productId, minLimit, maxLimit } = params;
  
  // Check if an order limit already exists for this product
  // Using numeric comparison with productId (database stores as number)
  const existingLimit = await api.OrderLimit.findFirst({
    filter: {
      productId: { equals: productId }
    }
  }).catch(() => null);

  if (existingLimit) {
    // Update the existing limit
    logger.info(`Updating existing order limit for product ${productId}`);
    return await api.OrderLimit.update(existingLimit.id, {
      minLimit,
      maxLimit
    });
  } else {
    // Create a new order limit
    // productId is passed as a number, maintaining numeric type consistency
    logger.info(`Creating new order limit for product ${productId}`);
    return await api.OrderLimit.create({
      productId, // This will be a number value as defined in the params
      minLimit,
      maxLimit
    });
  }
};

export const params = {
  productId: { type: "number" }, // Changed from string to number to match database schema
  minLimit: { type: "number" },
  maxLimit: { type: "number" }
};

export const options = {
  returns: true,
  triggers: { api: true }
};