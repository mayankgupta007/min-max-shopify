// import { Client } from "@gadget-client/low"; // Import the Gadget Client

// // Ensure gadgetConfig is available and fallback to a default environment if not
// const environment = window.gadgetConfig?.environment || "development";

// // Create a new instance of the Gadget Client
// const apiClient = new Client({ environment });

// // Export the API object with methods for each model
// export const api = {
//   // Global action for fetching order limit by productId
//   fetchOrderLimitByProductId: (params) => apiClient.fetchOrderLimitByProductId(params),
  
//   // Global action for saving order limits
//   saveOrderLimit: (params) => apiClient.saveOrderLimit(params),

//   OrderLimit: {
//     // Fetch all OrderLimit records
//     getOrderLimits: (id) => apiClient.OrderLimit.getOrderLimits(id),
//   },
// };

import { Client } from "@gadget-client/low"; // Import the Gadget Client

// Ensure gadgetConfig is available and fallback to a default environment if not
const environment = window.gadgetConfig?.environment || "development";

// Create a new instance of the Gadget Client
const apiClient = new Client({ environment });

// Export the API object with methods for each model
export const api = {
  // Re-export the entire client for direct access
  ...apiClient,
  
  // Global action for fetching order limit by productId
  fetchOrderLimitByProductId: (params) => apiClient.fetchOrderLimitByProductId(params),
  
  // Global action for saving order limits
  saveOrderLimit: (params) => apiClient.saveOrderLimit(params),

  // Add OrderLimit model actions
  OrderLimit: {
    findFirst: (options = {}) => apiClient.OrderLimit.findFirst(options),
    findMany: (options = {}) => apiClient.OrderLimit.findMany(options),
    maybeFindFirst: (options = {}) => apiClient.OrderLimit.findFirst(options).catch(() => null),
    create: (params) => apiClient.OrderLimit.create(params),
    update: (id, params) => apiClient.OrderLimit.update(id, params),
    delete: (id) => apiClient.OrderLimit.delete(id)
  },
  
  // Add shopifyShop model actions for dashboard initialization
  shopifyShop: {
    findFirst: (options = {}) => apiClient.shopifyShop.findFirst(options)
  }
};
