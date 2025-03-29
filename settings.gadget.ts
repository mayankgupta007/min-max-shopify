import type { GadgetSettings } from "gadget-server";

export const settings: GadgetSettings = {
  type: "gadget/settings/v1",
  frameworkVersion: "v1.3.0",
  plugins: {
    connections: {
      shopify: {
        apiVersion: "2024-10",
        enabledModels: [
          "shopifyFile",
          "shopifyProduct",
          "shopifyProductImage",
          "shopifyProductMedia",
          "shopifyProductOption",
          "shopifyProductVariant",
          "shopifyProductVariantMedia",
        ],
        type: "partner",
        scopes: [
          "read_products",
          "write_products",
          "read_product_listings",
          "unauthenticated_read_product_listings",
          "unauthenticated_read_product_pickup_locations",
        ],
      },
      openai: true,
    },
  },
};
