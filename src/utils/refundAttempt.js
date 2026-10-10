export const refundAttemptKey=(org,user,store,sale,product)=>`zenix:refund-attempt:v1:${org}:${user}:${store}:${sale}:${product}`;
export const refundReference=(storage,key,signature)=>{
 const pending=JSON.parse(storage.getItem(key)||'null');
 if(pending){if(pending.signature!==signature)throw new Error('Oldingi qaytarish javobi aniqlanmagan. Avval aynan shu miqdor va usul bilan qayta tekshiring.');return pending.reference}
 const reference=`RET-${crypto.randomUUID()}`;
 storage.setItem(key,JSON.stringify({reference,signature}));return reference;
};
export const acknowledgeRefund=(storage,key)=>storage.removeItem(key);
export const rejectRefund=(storage,key,result)=>{
 if(result.status>=400&&result.status<500&&result.code!=='IDEMPOTENCY_CONFLICT')acknowledgeRefund(storage,key);
};
