import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyScriptTag" model, go to https://low.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-ScriptTag",
  fields: {},
  shopify: {
    fields: [
      "cache",
      "displayScope",
      "event",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "source",
    ],
  },
};
