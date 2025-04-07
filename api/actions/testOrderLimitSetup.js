// api/actions/testOrderLimitSetup.js
export const run = async ({ params, logger, api, connections }) => {
  try {
    const results = {
      shopFound: false,
      scriptRegistration: null,
      appProxyTest: null
    };
    
    // Step 1: Find the shop
    const shop = params.shopDomain;
    logger.info(`Testing order limit setup for shop: ${shop}`);
    
    const shopRecord = await api.shopifyShop.findFirst({
      filter: {
        myshopifyDomain: { equals: shop }
      },
      select: {
        id: true
      }
    });
    
    if (!shopRecord) {
      logger.error(`Shop not found: ${shop}`);
      results.shopFound = false;
      return {
        success: false,
        error: `Shop not found: ${shop}`,
        results
      };
    }
    
    results.shopFound = true;
    
    // Step 2: Test script registration
    try {
      const scriptResult = await api.registerScriptTag({ shop });
      results.scriptRegistration = {
        success: true,
        details: scriptResult
      };
    } catch (error) {
      logger.error(`Script registration test failed: ${error.message}`);
      results.scriptRegistration = {
        success: false,
        error: error.message
      };
    }
    
    // Step 3: Create a test OrderLimit record if none exists
    try {
      const testProductId = 99999999;
      let orderLimit = await api.OrderLimit.findFirst({
        filter: {
          productId: { equals: testProductId }
        }
      });
      
      if (!orderLimit) {
        orderLimit = await api.OrderLimit.create({
          productId: testProductId,
          minLimit: 2,
          maxLimit: 10,
          productName: "Test Product"
        });
        logger.info(`Created test order limit with id: ${orderLimit.id}`);
      }
      
      // Step 4: Test app proxy fetch with this product ID
      const appDomain = api.connection.environment === 'development' ? 
                       'low--development.gadget.app' : 
                       'low.gadget.app';
      
      const appProxyUrl = `https://${appDomain}/api/public/app-proxy?shop=${shop}&path=product-limits-${testProductId}`;
      
      try {
        const response = await fetch(appProxyUrl);
        const data = await response.json();
        
        results.appProxyTest = {
          success: response.ok,
          status: response.status,
          data
        };
        
        logger.info(`App proxy test result: ${JSON.stringify(results.appProxyTest)}`);
      } catch (error) {
        logger.error(`App proxy test failed: ${error.message}`);
        results.appProxyTest = {
          success: false,
          error: error.message
        };
      }
    } catch (error) {
      logger.error(`Error in test order limit setup: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results
      };
    }
    
    return {
      success: true,
      results
    };
  } catch (error) {
    logger.error(`Error in test order limit setup: ${error.message}`);
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
