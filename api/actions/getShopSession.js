export const run = async ({ session, connections, logger, api }) => {
  logger.info("getShopSession called", {
    hasSession: !!session,
    hasShopify: !!connections.shopify,
    sessionRoles: session?.roles || [],
    shopifyConnectionKeys: connections.shopify ? Object.keys(connections.shopify) : []
  });

  try {
    // Try to determine shop from the session first
    if (session?.shop?.id) {
      logger.info("Found shop in session", { shopId: session.shop.id });
      return {
        authenticated: true,
        shopId: session.shop.id
      };
    }

    // Check Shopify connection for shop info
    if (connections.shopify?.currentShopId) {
      logger.info("Found shop ID in Shopify connection", { 
        shopId: connections.shopify.currentShopId
      });
      
      return {
        authenticated: true,
        shopId: connections.shopify.currentShopId
      };
    }

    // DEVELOPMENT FALLBACK: Try to access the first available shop
    if (process.env.NODE_ENV === "development") {
      try {
        logger.info("Using development fallback to find a shop");
        
        // Try three approaches to find a shop:
        
        // Approach 1: Use the internal API directly
        const shops = await api.internal.shopifyShop.findMany({
          first: 1,
          select: { id: true }
        });
        
        if (shops && shops.length > 0) {
          const shopId = shops[0].id;
          logger.info("Found fallback shop with internal API", { shopId });
          
          return {
            authenticated: true,
            shopId,
            isDevelopmentFallback: true
          };
        }
        
        // Approach 2: Try with the regular API
        const publicShops = await api.shopifyShop.findMany({
          first: 1,
          select: { id: true }
        });
        
        if (publicShops && publicShops.length > 0) {
          const shopId = publicShops[0].id;
          logger.info("Found fallback shop with public API", { shopId });
          
          return {
            authenticated: true,
            shopId,
            isDevelopmentFallback: true
          };
        }
        
        logger.warn("Failed to find any shops for development fallback");
      } catch (apiError) {
        logger.warn("Development fallback failed", { 
          error: apiError.message, 
          stack: apiError.stack
        });
      }
    }

    // If we got here, authentication failed
    logger.info("No authentication method succeeded");
    
    return {
      authenticated: false,
      message: "Not authenticated with Shopify yet"
    };
  } catch (error) {
    logger.error("Error in getShopSession", { error: error.message, stack: error.stack });
    
    return {
      authenticated: false,
      error: error.message
    };
  }
};

export const options = {
  returns: true,
  triggers: { api: true }
};
