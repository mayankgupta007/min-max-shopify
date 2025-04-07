import { Client } from "@gadget-client/low";

const environment = window.gadgetConfig?.environment || "development";
const apiClient = new Client({ environment });

export const api = {
  ...apiClient, // Include all client methods directly
  
  // Also expose specific functions for clarity
  fetchOrderLimitByProductId: (params) => apiClient.fetchOrderLimitByProductId(params),
  saveOrderLimit: (params) => apiClient.saveOrderLimit(params),
  getProductLimits: (params) => apiClient.getProductLimits(params),
  
  // Model-specific methods
  OrderLimit: {
    findMany: (options = {}) => apiClient.OrderLimit.findMany(options),
    findFirst: (options = {}) => apiClient.OrderLimit.findFirst(options),
    create: (data) => apiClient.OrderLimit.create(data),
    update: (id, data) => apiClient.OrderLimit.update(id, data),
    delete: (id) => apiClient.OrderLimit.delete(id)
  },
  
  shopifyShop: {
    findFirst: (options = {}) => apiClient.shopifyShop.findFirst(options)
  },
  
  shopifyProduct: {
    findFirst: (options = {}) => apiClient.shopifyProduct.findFirst(options),
    findMany: (options = {}) => apiClient.shopifyProduct.findMany(options)
  }
};
