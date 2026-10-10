// Only transaction intent is persisted. Authentication/card credentials never belong here.
export const attemptKey=(org,branch,user,operation)=>`zenix:attempt:v1:${org}:${branch}:${user}:${operation}`;
export function readAttempt(storage,key){
 try{const value=JSON.parse(storage.getItem(key)||'null');return value?.v===1&&typeof value.clientReference==='string'&&value.payload&&['pending','unknown'].includes(value.state)?value:null}catch{return null}
}
export function beginAttempt(storage,key,packet){
 const previous=readAttempt(storage,key);if(previous)return previous;
 const value={v:1,clientReference:packet.clientReference,payload:packet.payload,state:'pending',savedAt:Date.now()};
 storage.setItem(key,JSON.stringify(value));return value;
}
export function settleAttempt(storage,key,state){
 if(state==='confirmed'||state==='rejected'){storage.removeItem(key);return}
 const packet=readAttempt(storage,key);if(packet)storage.setItem(key,JSON.stringify({...packet,state:'unknown'}));
}
// Web Locks also serialize retry/receipt acknowledgement across tabs. The server remains idempotent.
export const withAttemptLock=(key,action)=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(key,action):action();
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export const isConfirmedSale=value=>Boolean(uuid(value?.id)&&String(value.sale_number||value.saleNumber||'').trim());
export const isConfirmedReceipt=value=>Boolean(uuid(value?.receiptId)&&Array.isArray(value.updated)&&value.updated.length&&value.updated.every(row=>uuid(row.productId||row.id)&&Number.isFinite(Number(row.quantity))));
