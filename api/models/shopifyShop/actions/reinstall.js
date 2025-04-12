import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

/** @type { ActionRun } */
export const run = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

/** @type { ActionOnSuccess } */
  export const onSuccess = async ({ params, record, logger, api, connections }) => {
    try {
      // Register script tag for the shop
      logger.info(`Registering script tag for shop during reinstall: ${record.myshopifyDomain}`);
      const result = await api.registerScriptTag({ shop: record.myshopifyDomain });
      logger.info(`Script tag registration result during reinstall:`, result);
    } catch (error) {
      logger.error(`Error registering script tag during reinstall: ${error.message}`, { error });
      // Don't fail the reinstallation process if script registration fails
    }
  };  

/** @type { ActionOptions } */
export const options = { actionType: "update" };
