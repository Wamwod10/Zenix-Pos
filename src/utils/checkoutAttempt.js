// Only transaction intent is persisted. Authentication/card credentials never belong here.
export const attemptKey=(org,branch,user,operation)=>`zenix:attempt:v1:${org}:${branch}:${user}:${operation}`;
// Proxy timeouts and unclassified conflicts do not prove a financial write failed.
export const isDefiniteWriteRejection=({status,code}={})=>status>=400&&status<500&&![408,425,429].includes(status)&&code!=='IDEMPOTENCY_CONFLICT'&&(status!==409||Boolean(code&&!['API_ERROR','REQUEST_FAILED'].includes(code)));
export function readAttempt(storage,key){
 try{const value=JSON.parse(storage.getItem(key)||'null');return value?.v===1&&typeof value.clientReference==='string'&&value.payload&&['pending','unknown'].includes(value.state)?value:null}catch{return null}
}
export function beginAttempt(storage,key,packet){
 const previous=readAttempt(storage,key);if(previous)return previous;
 const value={v:1,clientReference:packet.clientReference,payload:packet.payload,state:'pending',savedAt:Date.now()};
 storage.setItem(key,JSON.stringify(value));return value;
}
// Persist the exact first packet before dispatch; a changed amount/target is
// never silently substituted for an unresolved financial operation.
export function beginFinancialAttempt(storage,key,payload){
 const previous=readAttempt(storage,key);
 if(previous){
  const intent=value=>{const {clientReference,shiftId,...stable}=value;return JSON.stringify(stable)};
  if(intent(previous.payload)!==intent(payload))throw new Error('Oldingi to‘lov natijasi noma’lum. Avval aynan shu ma’lumotlar bilan qayta tekshiring.');
  return previous;
 }
 const clientReference=`FIN-${crypto.randomUUID()}`;
 return beginAttempt(storage,key,{clientReference,payload:{...payload,clientReference}});
}
export function settleAttempt(storage,key,state){
 if(state==='confirmed'||state==='rejected'){storage.removeItem(key);return}
 const packet=readAttempt(storage,key);if(packet)storage.setItem(key,JSON.stringify({...packet,state:'unknown'}));
}
// Web Locks also serialize retry/receipt acknowledgement across tabs. The server remains idempotent.
export const withAttemptLock=(key,action)=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(key,action):action();
export const prepareFinancialAttempt=(storage,key,payload)=>withAttemptLock(key,()=>{
 const previous=readAttempt(storage,key),packet=beginFinancialAttempt(storage,key,payload);
 if(previous){const shared={...packet,shared:true};storage.setItem(key,JSON.stringify(shared));return shared}
 return packet;
});
export const settleFinancialAttempt=(storage,key,reference,state)=>withAttemptLock(key,()=>{
 const current=readAttempt(storage,key);
 if(current?.clientReference!==reference)return state==='confirmed'?'confirmed':'unknown';
 // One tab's definite rejection cannot prove another shared dispatch failed.
 const resolved=state==='rejected'&&(current.shared||current.state==='unknown')?'unknown':state;
 settleAttempt(storage,key,resolved);return resolved;
});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export const isConfirmedFinancialRecord=value=>Boolean(uuid(value?.id)&&['number','string'].includes(typeof value.amount)&&String(value.amount).trim()!==''&&Number.isFinite(Number(value.amount))&&Number(value.amount)>=0);
export const isConfirmedSale=value=>Boolean(uuid(value?.id)&&String(value.sale_number||value.saleNumber||'').trim());
export const isConfirmedReceipt=value=>Boolean(uuid(value?.receiptId)&&Array.isArray(value.updated)&&value.updated.length&&value.updated.every(row=>uuid(row.productId||row.id)&&Number.isFinite(Number(row.quantity))));
export const isConfirmedTransfer=(value,intent)=>Boolean(uuid(value?.id)&&value.from_store_id===intent?.fromStoreId&&value.to_store_id===intent?.toStoreId);
