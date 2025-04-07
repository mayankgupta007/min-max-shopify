/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections }) => {
  const { productId, minLimit, maxLimit, productName } = params;

  // Check if an order limit already exists for this product
  const existingLimit = await api.OrderLimit.findFirst({
    filter: {
      productId: { equals: productId },
    },
  }).catch(() => null);

  let result;
  if (existingLimit) {
    // Update the existing limit
    logger.info(`Updating existing order limit for product ${productId}`);
    result = await api.OrderLimit.update(existingLimit.id, {
      minLimit,
      maxLimit,
      productName: productName !== undefined ? productName : existingLimit.productName, // Explicitly check for undefined
    });
  } else {
    // Create a new order limit
    logger.info(`Creating new order limit for product ${productId}`);
    result = await api.OrderLimit.create({
      productId,
      minLimit,
      maxLimit,
      productName: productName || `Product ${productId}`, // Default name if not provided
    });
  }
  
  // Ensure script tag is registered when a limit is created or updated
  try {
    // Get the current shop's domain (if we're in a shop context)
    let shopDomain;
    if (connections.shopify.currentShopId) {
      const currentShop = await api.shopifyShop.findOne(connections.shopify.currentShopId, {
        select: {
          myshopifyDomain: true
        }
      });
      shopDomain = currentShop?.myshopifyDomain;
    }
    
    // Only call if we have a shop in context
    if (shopDomain) {
      // Call ensureScriptTagRegistered with the specific shop
      await api.ensureScriptTagRegistered({ shop: shopDomain });
      logger.info(`Verified script registration for shop ${shopDomain} after saving order limit`);
    } else {
      logger.info("No shop context available, skipping script tag verification");
    }
  } catch (error) {
    logger.warn(`Error ensuring script tags after saving order limit: ${error.message}`, { error });
    // Don't fail the main operation if this fails
  }
  
  return result;
};

export const params = {
  productId: { type: "number" },
  minLimit: { type: "number" },
  maxLimit: { type: "number" },
  productName: { type: "string", optional: true },
};

export const options = {
  returns: true,
  triggers: { api: true },
};
