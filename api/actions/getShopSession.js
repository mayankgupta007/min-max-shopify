export const run = async ({ params, session, connections, logger, api }) => {
  logger.info("getShopSession called", {
    hasSession: !!session,
    hasShopify: !!connections.shopify,
    sessionRoles: session?.roles || [],
    shopifyConnectionKeys: connections.shopify ? Object.keys(connections.shopify) : [],
    shopDomainFromParams: params?.shopDomain
  });

  try {
    // Try to determine shop from the session first
    if (session?.shop?.id) {
      logger.info("Found shop in session", { 
        shopId: session.shop.id,
        shopDomain: session.shop.myshopifyDomain || 'unknown'
      });
      return {
        authenticated: true,
        shopId: session.shop.id,
        shopDomain: session.shop.myshopifyDomain
      };
    }

    // Check Shopify connection for shop info
    if (connections.shopify?.currentShopId) {
      // Try to get the domain for this shop
      const shop = await api.shopifyShop.findOne(connections.shopify.currentShopId, {
        select: { id: true, myshopifyDomain: true }
      });
      
      logger.info("Found shop ID in Shopify connection", { 
        shopId: connections.shopify.currentShopId,
        shopDomain: shop?.myshopifyDomain || 'unknown'
      });
      
      return {
        authenticated: true,
        shopId: connections.shopify.currentShopId,
        shopDomain: shop?.myshopifyDomain
      };
    }

    // DEVELOPMENT FALLBACK: Try to find the correct shop by domain
    if (process.env.NODE_ENV === "development") {
      try {
        const { shopDomain } = params || {};
        logger.info("Using development fallback to find a shop", { providedShopDomain: shopDomain });
        
        // If we have a specific shop domain from URL, use it first
        if (shopDomain) {
          // Try to find the shop by domain
          const shopByDomain = await api.shopifyShop.findMany({
            filter: {
              OR: [
                { myshopifyDomain: { equals: shopDomain } },
                { domain: { equals: shopDomain } }
              ]
            },
            select: { id: true, myshopifyDomain: true }
          });
          
          if (shopByDomain && shopByDomain.length > 0) {
            const shopId = shopByDomain[0].id;
            logger.info("Found shop by domain", { 
              shopId, 
              domain: shopByDomain[0].myshopifyDomain 
            });
            
            return {
              authenticated: true,
              shopId,
              shopDomain: shopByDomain[0].myshopifyDomain,
              isDevelopmentFallback: true
            };
          } else {
            logger.warn(`No shop found for domain: ${shopDomain}`);
          }
        }
        
        // If no domain provided or no shop found by domain, list all shops to help debugging
        const allShops = await api.shopifyShop.findMany({
          select: { id: true, myshopifyDomain: true }
        });
        
        if (allShops && allShops.length > 0) {
          // Log all available shops for debugging
          logger.info("Available shops for development:", { 
            shops: allShops.map(s => ({ id: s.id, domain: s.myshopifyDomain })) 
          });
          
          // If we still need to return a fallback shop, return the first one
          const shopId = allShops[0].id;
          logger.warn("No shop found by domain, using first available shop", { 
            shopId, 
            domain: allShops[0].myshopifyDomain,
            requestedDomain: shopDomain
          });
          
          return {
            authenticated: true,
            shopId,
            shopDomain: allShops[0].myshopifyDomain,
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

export const params = {
  shopDomain: { type: "string", optional: true }
};

export const options = {
  returns: true,
  triggers: { api: true }
};
