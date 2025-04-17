/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections, session }) => {
  const { productId, minLimit, maxLimit, productName, shopId: providedShopId } = params;

  // Get the current shop ID from session or connections
  const sessionShopId = session?.shop?.id || connections.shopify?.currentShopId;

  // Use provided shopId if available, fallback to session shop
  const shopId = providedShopId || sessionShopId;

  if (!shopId) {
    logger.error("No shop ID available from params, session, or connections");
    throw new Error("Shop identification required");
  }

  // Check if an order limit already exists for this product AND shop
  const existingLimit = await api.OrderLimit.findFirst({
    filter: {
      AND: [
        { productId: { equals: productId } },
        { shop: { id: { equals: shopId } } }
      ]
    },
  }).catch(() => null);

  let result;
  if (existingLimit) {
    // Update the existing limit
    logger.info(`Updating existing order limit for product ${productId} in shop ${shopId}`);
    result = await api.OrderLimit.update(existingLimit.id, {
      minLimit,
      maxLimit,
      productName: productName !== undefined ? productName : existingLimit.productName,
      // Use proper relationship field format
      shop: {
        _link: shopId
      }
    });
  } else {
    // Create a new order limit
    logger.info(`Creating new order limit for product ${productId} in shop ${shopId}`);
    result = await api.OrderLimit.create({
      productId,
      minLimit,
      maxLimit,
      productName: productName || `Product ${productId}`,
      // Use proper relationship field format
      shop: {
        _link: shopId
      }
    });
  }

  // Ensure script tag is registered when a limit is created or updated
  try {
    // Get the current shop's domain (if we're in a shop context)
    let shopDomain;
    if (shopId) {
      const currentShop = await api.shopifyShop.findOne(shopId, {
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
      logger.info("No shop domain available, skipping script tag verification");
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
  shopId: { type: "string", optional: true },
};

export const options = {
  returns: true,
  triggers: { api: true },
};
