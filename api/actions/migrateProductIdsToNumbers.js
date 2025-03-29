/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections }) => {
  logger.info("Starting productId migration from strings to numbers");
  
  // Utility function to extract numeric ID from string or GID
  const extractNumericId = (productId) => {
    if (typeof productId === "number") {
      return productId; // Already a number
    }
    
    // Check if it's a Shopify GID format
    if (typeof productId === "string" && productId.includes("gid://")) {
      // Extract the numeric ID after the last "/"
      const match = productId.match(/\/(\d+)$/);
      if (match && match[1]) {
        return Number(match[1]);
      }
    }
    
    // If it's just a numeric string, convert directly
    if (typeof productId === "string" && !isNaN(Number(productId))) {
      return Number(productId);
    }
    
    // Return original if no conversion was possible
    return productId;
  };

  // Query all OrderLimit records
  const allOrderLimits = await api.OrderLimit.findMany();
  logger.info(`Found ${allOrderLimits.length} OrderLimit records to check`);

  let convertedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // Process each record
  for (const orderLimit of allOrderLimits) {
    try {
      const originalProductId = orderLimit.productId;
      
      // Check if productId is a string or needs conversion
      if (typeof originalProductId === "string" || 
          (originalProductId && typeof originalProductId === "object")) {
        const numericId = extractNumericId(originalProductId);
        
        // Only update if we got a valid number and it's different from the original
        if (typeof numericId === "number" && numericId !== originalProductId) {
          logger.info(`Converting OrderLimit ${orderLimit.id}: productId from "${originalProductId}" to ${numericId}`);
          
          // Update the record
          await api.OrderLimit.update(orderLimit.id, {
            productId: numericId
          });
          
          convertedCount++;
        } else {
          logger.debug(`Skipping OrderLimit ${orderLimit.id}: productId "${originalProductId}" cannot be converted to a number`);
          skippedCount++;
        }
      } else {
        logger.debug(`Skipping OrderLimit ${orderLimit.id}: productId ${originalProductId} is already a number`);
        skippedCount++;
      }
    } catch (error) {
      logger.error(`Failed to process OrderLimit ${orderLimit.id}: ${error.message}`);
      failedCount++;
    }
  }

  // Log summary
  logger.info(`ProductId migration completed:
    - Total records processed: ${allOrderLimits.length}
    - Successfully converted: ${convertedCount}
    - Skipped (already numbers or unconvertible): ${skippedCount}
    - Failed: ${failedCount}
  `);

  return {
    total: allOrderLimits.length,
    converted: convertedCount,
    skipped: skippedCount,
    failed: failedCount
  };
};

/**
 * Expose the action via API so it can be triggered manually
 */
export const options = {
  triggers: { api: true }
};