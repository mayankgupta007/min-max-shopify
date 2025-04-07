// api/actions/registerScriptTag.js
export const run = async ({ params, logger, api, connections }) => {
  try {
    const { shop: shopDomain } = params;
    
    // First find the shop record by domain
    const shopRecord = await api.shopifyShop.findFirst({
      filter: {
        myshopifyDomain: { equals: shopDomain }
      },
      select: {
        id: true
      }
    });
    
    if (!shopRecord) {
      throw new Error(`Shop not found with domain: ${shopDomain}`);
    }
    
    // Get the proper Shopify client - make sure to await it
    const shopify = await connections.shopify.forShopId(shopRecord.id);
    
    // First check if script tag already exists
    logger.info(`Checking for existing script tags for shop: ${shopDomain}`);
    const existingScripts = await shopify.scriptTag.list();

    // Use a public URL (not /public/ in the path)
    // This is important! The file should be accessible at the root URL
    const scriptUrl = `https://${api.connection.environment === 'development' ? 'low--development' : 'low'}.gadget.app/public/orderLimitValidator.js`;
    
    logger.info(`Using script URL: ${scriptUrl}`);
    
    // Only register if not already registered
    const existingScript = existingScripts.find(script => 
      script.src.includes('orderLimitValidator.js')
    );

    if (existingScript) {
      logger.info(`Script tag already exists for shop: ${shopDomain} with id: ${existingScript.id}`);
      
      // If the script exists but the URL has changed, update it
      if (existingScript.src !== scriptUrl) {
        logger.info(`Updating script tag URL from ${existingScript.src} to ${scriptUrl}`);
        const updatedScript = await shopify.scriptTag.update(existingScript.id, {
          src: scriptUrl,
          event: 'onload'
        });
        
        return { 
          success: true, 
          updated: true,
          scriptId: updatedScript.id,
          src: updatedScript.src
        };
      }
      
      return { 
        success: true, 
        alreadyExists: true,
        scriptId: existingScript.id,
        src: existingScript.src
      };
    }
    
    // Register the script tag
    const scriptTag = await shopify.scriptTag.create({
      event: 'onload',
      src: scriptUrl
    });
    
    logger.info(`Script tag registered for shop: ${shopDomain} with id: ${scriptTag.id}`);
    return { 
      success: true, 
      alreadyExists: false,
      scriptId: scriptTag.id,
      src: scriptTag.src
    };
  } catch (error) {
    logger.error(`Error registering script tag: ${error.message}`, { error });
    throw error;
  }
};

export const params = {
  shop: { type: "string" }
};

export const options = {
  returns: true,
  triggers: { api: true }
};
