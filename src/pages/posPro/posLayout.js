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
