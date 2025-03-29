import { api } from "../api"; // Import the API instance

/**
 * Extracts the numeric part of a Shopify Global ID and converts it to a number.
 * @param {string|number} input - The Shopify Global ID or numeric input.
 * @returns {number} - The extracted numeric ID as a number.
 */
export const extractNumericId = (input) => {
  // If input is already a number, return it
  if (typeof input === 'number') return input;
  
  // If input is a string
  if (typeof input === 'string') {
    // Check if it's a Shopify GID (gid://shopify/Product/12345)
    if (input.startsWith('gid://')) {
      const match = input.match(/\/([0-9]+)$/);
      if (match && match[1]) {
        return Number(match[1]);
      }
      throw new Error(`Invalid Shopify Global ID format: ${input}`);
    }
    
    // If it's a numeric string, convert it
    if (/^[0-9]+$/.test(input)) {
      return Number(input);
    }
  }
  
  // If we got here, the input is neither a number nor a valid string
  throw new Error(`Cannot extract numeric ID from: ${input}. Input must be a number, numeric string, or Shopify Global ID.`);
};

/**
 * Fetch a single OrderLimit record by productId.
 * @param {string|number} input - The Shopify Global ID or numeric product ID.
 * @returns {Promise<Object|null>} - Returns the fetched OrderLimit record or null if not found.
 */
export const fetchOrderLimitById = async (input) => {
  try {
    // Try to extract/convert the numeric ID
    const numericId = extractNumericId(input);
    console.log(`Fetching OrderLimit for productId=${numericId}`);
    
    // Attempt to fetch the order limit with the numeric ID
    const response = await api.fetchOrderLimitByProductId({productId: numericId});
    
    if (!response) {
      console.log(`No existing OrderLimit for productId=${numericId}. Returning null.`);
      return null;
    }
    
    console.log(`Fetched Order Limit for productId ${numericId}:`, response);
    return response;
  } catch (error) {
    // Log and rethrow the error with more context
    console.error(`Error fetching Order Limit: ${error.message}`);
    throw new Error(`Failed to fetch order limit: ${error.message}`);
  }
};


/**
 * Save or update an OrderLimit record.
 * @param {Object} data - The data to save or update (e.g., productId, minLimit, maxLimit).
 * @returns {Promise<Object>} - Returns the saved or updated OrderLimit record.
 */
export const saveOrderLimit = async (data) => {
  try {
    // Ensure productId is a number if it exists in the data
    const processedData = { ...data };
    
    if (processedData.productId) {
      // Check if productId is a Shopify GID that needs conversion
      if (typeof processedData.productId === 'string' && processedData.productId.startsWith('gid://')) {
        processedData.productId = extractNumericId(processedData.productId);
      } 
      // Otherwise, ensure it's a number even if it's a string containing just digits
      else if (typeof processedData.productId === 'string') {
        processedData.productId = Number(processedData.productId);
      }
      // Numbers pass through unchanged
    }
    
    const result = await api.saveOrderLimit(processedData); // Call the global saveOrderLimit action
    console.log("Saved Order Limit:", result);
    return result.OrderLimit;
  } catch (error) {
    console.error("Error saving Order Limit:", error);
    throw error;
  }
};
