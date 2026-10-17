import {isDefiniteWriteRejection} from './checkoutAttempt.js';
export const refundAttemptKey=(org,user,store,sale,product)=>`zenix:refund-attempt:v1:${org}:${user}:${store}:${sale}:${product}`;
export const refundReference=(storage,key,signature)=>{
 const pending=JSON.parse(storage.getItem(key)||'null');
 if(pending){if(pending.signature!==signature)throw new Error('Oldingi qaytarish javobi aniqlanmagan. Avval aynan shu miqdor va usul bilan qayta tekshiring.');return pending.reference}
 const reference=`RET-${crypto.randomUUID()}`;
 storage.setItem(key,JSON.stringify({reference,signature}));return reference;
};
export const refundPayload=(storage,key,payload)=>{
 const pending=JSON.parse(storage.getItem(key)||'null');
 if(pending&&pending.reference!==payload.clientReference)throw new Error('Oldingi qaytarish natijasini avval tekshiring.');
 if(pending?.payload)return pending.payload;
 const packet={...(pending||{reference:payload.clientReference,signature:JSON.stringify([payload.quantity,payload.refundMethod,payload.reason])}),payload};
 storage.setItem(key,JSON.stringify(packet));
 return JSON.parse(JSON.stringify(payload));
};
export const isConfirmedRefund=value=>Boolean(typeof value?.id==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.id)&&['number','string'].includes(typeof value.amount)&&String(value.amount).trim()!==''&&Number.isFinite(Number(value.amount))&&Number(value.amount)>=0);
export const acknowledgeRefund=(storage,key)=>storage.removeItem(key);
export const rejectRefund=(storage,key,result)=>{
 if(isDefiniteWriteRejection(result))acknowledgeRefund(storage,key);
};
