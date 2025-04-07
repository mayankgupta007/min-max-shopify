// api/actions/ensureScriptTagRegistered.js
/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections }) => {
  try {
    // If a specific shop is provided in params, use that
    // Otherwise, try to get the current shop from the Shopify connection
    let shopDomain = params.shop;
    
    if (!shopDomain && connections.shopify.currentShopId) {
      // Get the shopDomain from the current authenticated shop
      const currentShop = await api.shopifyShop.findOne(connections.shopify.currentShopId, {
        select: {
          myshopifyDomain: true
        }
      });
      
      if (currentShop) {
        shopDomain = currentShop.myshopifyDomain;
      }
    }
    
    if (!shopDomain) {
      throw new Error("No shop specified and no current shop found in context");
    }
    
    logger.info(`Ensuring script registration for shop: ${shopDomain}`);
    
    try {
      const result = await api.registerScriptTag({ shop: shopDomain });
      
      return {
        shop: shopDomain,
        success: true,
        alreadyExists: result.alreadyExists,
        scriptId: result.scriptId
      };
    } catch (error) {
      logger.error(`Failed to register script for shop ${shopDomain}: ${error.message}`);
      
      return {
        shop: shopDomain,
        success: false,
        error: error.message
      };
    }
  } catch (error) {
    logger.error(`Error ensuring script tag registration: ${error.message}`, { error });
    throw error;
  }
};

export const params = {
  shop: { type: "string", optional: true }
};

export const options = {
  returns: true,
  triggers: { api: true }
};
