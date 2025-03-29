import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "User" model, go to https://low.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "jhQ8vkZJ3d2y",
  fields: {
    email: { type: "email", storageKey: "xJFA2Yqht23c" },
    firstName: { type: "string", storageKey: "MJWdaKspv8xL" },
    isActive: {
      type: "boolean",
      default: true,
      storageKey: "1lvNYVIfoV4w",
    },
    lastName: { type: "string", storageKey: "p5ejiQ_Yq-TZ" },
    role: {
      type: "enum",
      default: "user",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["admin", "user"],
      storageKey: "G_itlS0vOpIS",
    },
    shopifyShopId: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "o2UUsD4bFDuy",
    },
  },
};
