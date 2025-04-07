// api/models/shopifyShop/actions/install.js
import { applyParams, save } from "gadget-server";

export const run = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await save(record);
};

export const onSuccess = async ({ params, record, logger, api, connections }) => {
  try {
    // Register script tag for the shop
    logger.info(`Registering script tag for shop: ${record.myshopifyDomain}`);
    const result = await api.registerScriptTag({ shop: record.myshopifyDomain });
    logger.info(`Script tag registration result:`, result);
  } catch (error) {
    logger.error(`Error registering script tag during install: ${error.message}`, { error });
    // Don't fail the installation process if script registration fails
  }
};

export const options = { actionType: "create" };



// import { applyParams, save, ActionOptions } from "gadget-server";

// /** @type { ActionRun } */
// export const run = async ({ params, record, logger, api, connections }) => {
//   applyParams(params, record);
//   await save(record);
// };

// /** @type { ActionOnSuccess } */
// export const onSuccess = async ({ params, record, logger, api, connections }) => {
//   // Your logic goes here
// };

// /** @type { ActionOptions } */
// export const options = { actionType: "create" };
