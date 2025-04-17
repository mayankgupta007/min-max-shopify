import { api } from "../api";

/**
 * Extracts the numeric part of a Shopify Global ID and converts it to a number.
 * @param {string|number} input - The Shopify Global ID or numeric input.
 * @returns {number} - The extracted numeric ID as a number.
 */
export const extractNumericId = (input) => {
  // If input is null or undefined, throw an error
  if (input === null || input === undefined) {
    throw new Error("Product ID cannot be null or undefined");
  }
  
  // If input is already a number, validate it
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) {
      throw new Error(`Invalid product ID: ${input}. Must be a positive number.`);
    }
    return input;
  }
  
  // If input is a string
  if (typeof input === 'string') {
    // Check if it's a Shopify GID (gid://shopify/Product/12345)
    if (input.startsWith('gid://')) {
      const match = input.match(/\/([0-9]+)$/);
      if (match && match[1]) {
        const numericId = Number(match[1]);
        if (isNaN(numericId) || numericId <= 0) {
          throw new Error(`Invalid product ID extracted from ${input}. Must be a positive number.`);
        }
        return numericId;
      }
      throw new Error(`Invalid Shopify Global ID format: ${input}`);
    }
    
    // If it's a numeric string, convert it
    if (/^[0-9]+$/.test(input)) {
      const numericId = Number(input);
      if (numericId <= 0) {
        throw new Error(`Invalid product ID: ${input}. Must be a positive number.`);
      }
      return numericId;
    }
  }
  
  // If we got here, the input is neither a valid number nor a valid string
  throw new Error(`Cannot extract numeric ID from: ${input}. Input must be a number, numeric string, or Shopify Global ID.`);
};

/**
 * Fetch a single OrderLimit record by productId.
 * @param {string|number} input - The Shopify Global ID or numeric product ID.
 * @returns {Promise<Object|null>} - Returns the fetched OrderLimit record or null if not found.
 */
export const fetchOrderLimitById = async (input) => {
  try {
    console.log("fetchOrderLimitById called with input:", input);
    
    // If input is invalid, return null instead of making an API call
    if (input === null || input === undefined || input === "") {
      console.warn("Cannot fetch order limit: Product ID is null or undefined");
      return null;
    }
    
    // Convert input to a valid numeric ID
    let numericId;
    try {
      numericId = extractNumericId(input);
      console.log(`Successfully extracted numericId=${numericId} from input`);
    } catch (error) {
      console.warn(`Failed to extract numeric ID from input: ${error.message}`);
      return null;
    }
    
    // Double check that we have a valid numeric ID
    if (!numericId || isNaN(numericId) || numericId <= 0) {
      console.warn(`Invalid numericId: ${numericId}`);
      return null;
    }
    
    console.log(`Calling API with productId=${numericId}`);
    
    try {
      const response = await api.fetchOrderLimitByProductId({
        productId: numericId
      });
      
      // Handle null response
      if (!response) {
        console.log(`No order limit found for productId=${numericId}`);
        return null;
      }
      
      console.log(`Fetched order limit:`, response);
      return response;
    } catch (error) {
      // Specific handling for "not found" errors
      if (error?.message?.includes("not found") || 
          error?.message?.includes("Invalid product ID") ||
          error?.message?.includes("No limits found")) {
        console.log(`Expected error (product limit not found): ${error.message}`);
        return null;
      }
      
      // For other errors, rethrow
      throw error;
    }
  } catch (error) {
    console.error(`Error in fetchOrderLimitById: ${error.message}`);
    return null; // Return null for all errors to avoid UI disruption
  }
};



/**
 * Save or update an OrderLimit record.
 * @param {Object} data - The data to save or update (e.g., productId, minLimit, maxLimit).
 * @returns {Promise<Object>} - Returns the saved or updated OrderLimit record.
 */
export const saveOrderLimit = async (data) => {
  try {
    const processedData = { ...data };

    // Process numeric productId
    if (processedData.productId) {
      if (typeof processedData.productId === "string" && processedData.productId.startsWith("gid://")) {
        processedData.productId = extractNumericId(processedData.productId);
      } else if (typeof processedData.productId === "string") {
        processedData.productId = Number(processedData.productId);
      }
    }

    // Ensure we have a product name
    if (processedData.productName === undefined && processedData.productTitle) {
      processedData.productName = processedData.productTitle;
    }

    // DO NOT add shop._link - we will pass shopId directly to the global action
    // The global action will handle the conversion to shop._link format

    console.log("Saving order limit with processed data:", processedData);

    const result = await api.saveOrderLimit(processedData);
    console.log("Save order limit result:", result);

    if (result && result.OrderLimit) {
      return result.OrderLimit;
    } else if (result && result.id) {
      return result;
    } else {
      return result;
    }
  } catch (error) {
    console.error("Error saving Order Limit:", error);
    throw new Error(`Failed to save order limit: ${error.message || "Unknown error"}`);
  }
};




/**
 * Fetch all order limits with product details
 * @returns {Promise<Array>} Array of order limits with product details
 */
export const fetchAllOrderLimits = async () => {
  try {
    console.log("Fetching all order limits");
    
    // Fetch all order limits
    const allLimits = await api.OrderLimit.findMany();
    console.log(`Found ${allLimits.length} order limits`);
    
    // Enrich with product details where possible
    const enrichedLimits = await Promise.all(
      allLimits.map(async (limit) => {
        try {
          // Try to get product details from Shopify
          const product = await api.shopifyProduct.findFirst({
            filter: { id: { equals: String(limit.productId) } }
          });
          
          return {
            ...limit,
            productName: product ? product.title : `Product ${limit.productId}`,
            productInfo: product || null
          };
        } catch (error) {
          console.error(`Error getting product info for ${limit.productId}:`, error);
          return {
            ...limit,
            productName: `Product ${limit.productId}`,
            productInfo: null
          };
        }
      })
    );
    
    return enrichedLimits;
  } catch (error) {
    console.error("Error fetching all order limits:", error);
    throw new Error(`Failed to fetch all order limits: ${error.message || 'Unknown error'}`);
  }
};
