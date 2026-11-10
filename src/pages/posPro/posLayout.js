// Presentation-only POS Pro layout: no sales, stock, billing, checkout, or
// permissions decisions are taken here. Existing cashier preferences survive.
const LAYOUTS=new Set(['classic','touch','quick']);
export function normalizedPosLayout(saved){
 return LAYOUTS.has(saved)?saved:'classic';
}
export function posCatalogVisible({layout='classic',search='',category='',catalogMode='all',browse=false}={}){
 if(layout!=='quick')return true;
 return Boolean(String(search).trim()||String(category).trim()||browse||catalogMode==='popular');
}

export function posSearchResults({products=[],catalogMode='all',search='',searchReady=true}={}){
 // Old search/category results remain in the cache during the 160 ms
 // debounce. Do not present them as belonging to the new filter (including
 // when the user clears the category and returns to all products).
 if(catalogMode==='all'&&!searchReady)return [];
 return products;
}

export function posPrimaryPaymentMethod(paymentMethods={},creditAllowed=true){
 // F12 must honor the exact payment methods configured for this workspace.
 // Prefer common immediate methods; credit is offered only if enabled.
 const allowed=paymentMethods&&typeof paymentMethods==='object'?paymentMethods:{};
 return ['cash','card','transfer','split','credit']
  .find(method=>allowed[method]!==false&&(method!=='credit'||creditAllowed))||null;
}
