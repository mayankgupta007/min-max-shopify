// api/actions/manualRegisterScriptTag.js
export const run = async ({ params, logger, api, connections }) => {
  try {
    const { shopDomain } = params;
    
    logger.info(`Manually registering script tag for shop: ${shopDomain}`);
    
    // Find the shop by domain
    const shopRecord = await api.shopifyShop.findFirst({
      filter: {
        myshopifyDomain: { equals: shopDomain }
      },
      select: {
        id: true
      }
    });
    
    if (!shopRecord) {
      logger.error(`Shop not found: ${shopDomain}`);
      return {
        success: false,
        error: `Shop not found: ${shopDomain}`
      };
    }
    
    // Call the registration action
    const result = await api.registerScriptTag({ shop: shopDomain });
    
    logger.info(`Manual script tag registration result:`, result);
    return {
      success: true,
      result
    };
  } catch (error) {
    logger.error(`Error in manual script registration: ${error.message}`, { error });
    return {
      success: false,
      error: error.message
    };
  }
};

export const params = {
  shopDomain: { type: "string" }
};

export const options = {
  returns: true,
  triggers: { api: true }
};
