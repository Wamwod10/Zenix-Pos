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
 // An old query can remain in the cache while the 160 ms debounce runs.
 // Never present its products as matches for a newly typed search.
 if(catalogMode==='all'&&String(search).trim()&&!searchReady)return [];
 return products;
}
