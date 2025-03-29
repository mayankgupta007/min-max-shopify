// import React, { useState, useEffect } from "react";
// import { Page, Button } from "@shopify/polaris";
// import { useAppBridge } from "@shopify/app-bridge-react";
// import { ResourcePicker } from "@shopify/app-bridge/actions";

// export default function ProductPicker() {
//   const app = useAppBridge(); // Get App Bridge instance
//   const [picker, setPicker] = useState(null);
//   const [selectedProduct, setSelectedProduct] = useState(null);

//   useEffect(() => {
//     if (app) {
//       // Initialize the ResourcePicker
//       const resourcePicker = ResourcePicker.create(app, {
//         resourceType: ResourcePicker.ResourceType.Product,
//         options: {
//           selectMultiple: false,
//           showVariants: false,
//         },
//       });

//       // Subscribe to the SELECT action
//       resourcePicker.subscribe(ResourcePicker.Action.SELECT, (selectPayload) => {
//         const selection = selectPayload.selection;
//         console.log("Selected product:", selection[0]);
//         setSelectedProduct(selection[0]); // Save selected product
//       });

//       // Subscribe to the CANCEL action
//       resourcePicker.subscribe(ResourcePicker.Action.CANCEL, () => {
//         console.log("Resource picker was canceled.");
//       });

//       setPicker(resourcePicker); // Store picker instance in state
//     }
//   }, [app]);

//   const openProductPicker = () => {
//     if (picker) {
//       picker.dispatch(ResourcePicker.Action.OPEN); // Open the picker
//     } else {
//       console.error("ResourcePicker is not initialized.");
//     }
//   };

//   return (
//     <Page>
//       <Button onClick={openProductPicker}>
//         {selectedProduct ? `Selected: ${selectedProduct.title}` : "Select Product"}
//       </Button>
//     </Page>
//   );
// }
