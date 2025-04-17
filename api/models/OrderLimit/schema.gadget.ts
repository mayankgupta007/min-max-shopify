import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "OrderLimit" model, go to https://low.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "VWbmuKQuDlZe",
  fields: {
    maxLimit: {
      type: "number",
      validations: { required: true },
      storageKey: "ilaQHAtSIbtG",
    },
    minLimit: {
      type: "number",
      validations: { required: true },
      storageKey: "FottA44ZEfQq",
    },
    productId: {
      type: "number",
      validations: { required: true, unique: true },
      storageKey: "TybEu3mAIE-o",
    },
    productName: { type: "string", storageKey: "9fp3tnyB6xo5" },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "Q619mHp-U82Y",
    },
  },
};
