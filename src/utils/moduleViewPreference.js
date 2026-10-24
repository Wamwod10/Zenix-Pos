export const moduleViewKey=(module,organizationId,userId)=>JSON.stringify(["zenix-module-view",organizationId||"workspace",userId||"anonymous",module]);
export const readModuleView=(storage,key)=>{try{const value=storage.getItem(key);return value==="list"?"list":"grid"}catch{return "grid"}};
