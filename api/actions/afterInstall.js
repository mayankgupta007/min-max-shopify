// api/actions/afterInstall.js
export const run = async ({ params, logger, api }) => {
  try {
    // Register script tag for the shop
    await api.registerScriptTag({ shop: params.shop });
    
    logger.info(`App installation completed for shop: ${params.shop}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error during app installation: ${error.message}`, { error });
    throw error;
  }
};

export const params = {
  shop: { type: "string" }
};

export const options = {
  returns: true,
  triggers: { 
    api: true
    // Remove the invalid Shopify webhook trigger since app installation
    // is handled through OAuth, not webhooks
  }
};
