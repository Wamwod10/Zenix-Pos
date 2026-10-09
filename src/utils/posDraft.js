/** POS draft is device-local, user+tenant+branch scoped, never credentials. */
export const posDraftKey=(org,user,store)=>`zenix:pos-draft:v1:${String(org||"")}:${String(user||"")}:${String(store||"")}`;
export const readPosDraft=(storage,key)=>{try{const data=JSON.parse(storage.getItem(key)||"null");if(!data||data.v!==1||!Array.isArray(data.cart)||data.cart.length>250)return null;return data}catch{return null}};
// The last seen price/name support change notices; they never authorize a sale.
export const persistedCartIntent=(cart)=>Array.isArray(cart)?cart.map(line=>({id:line.id,cartQty:line.cartQty,discountPercent:line.discountPercent,name:line.name,sellPrice:line.sellPrice??line.price,...(line.tracking?{tracking:line.tracking}:{})})):[];
export const savePosDraft=(storage,key,data)=>{try{storage.setItem(key,JSON.stringify({v:1,...data,cart:persistedCartIntent(data.cart),savedAt:Date.now()}));return true}catch{return false}};
export const clearPosDraft=(storage,key)=>{try{storage.removeItem(key)}catch{}};
