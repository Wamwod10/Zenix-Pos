import {isDefiniteWriteRejection,isConfirmedFinancialRecord,withAttemptLock} from './checkoutAttempt.js';
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
export const isConfirmedRefund=isConfirmedFinancialRecord;
export const prepareRefundReference=(storage,key,signature)=>withAttemptLock(key,()=>{
 const pending=JSON.parse(storage.getItem(key)||'null'),reference=refundReference(storage,key,signature);
 if(pending)storage.setItem(key,JSON.stringify({...pending,shared:true}));return reference;
});
export const prepareRefundPayload=(storage,key,payload)=>withAttemptLock(key,()=>refundPayload(storage,key,payload));
export const acknowledgeRefund=(storage,key,reference)=>{
 if(reference!==undefined&&JSON.parse(storage.getItem(key)||'null')?.reference!==reference)return;
 storage.removeItem(key);
};
export const rejectRefund=(storage,key,result,reference)=>{
 const pending=JSON.parse(storage.getItem(key)||'null');
 if(pending?.shared)return;
 if(isDefiniteWriteRejection(result))acknowledgeRefund(storage,key,reference);
};
export const settleRefund=(storage,key,reference,result)=>withAttemptLock(key,()=>{
 if(reference===undefined)return;
 if(result===null)acknowledgeRefund(storage,key,reference);else rejectRefund(storage,key,result,reference);
});
