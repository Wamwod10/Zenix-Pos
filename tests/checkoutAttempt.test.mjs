import test from 'node:test';
import assert from 'node:assert/strict';
import {attemptKey,readAttempt,beginAttempt,settleAttempt,isConfirmedSale,isConfirmedReceipt,isDefiniteWriteRejection} from '../src/utils/checkoutAttempt.js';
import * as attempts from '../src/utils/checkoutAttempt.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};

test('transfer confirmation requires an actual transfer in the submitted branches',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 assert.equal(typeof attempts.isConfirmedTransfer,'function');
 assert.equal(attempts.isConfirmedTransfer({id,from_store_id:'a',to_store_id:'b'},{fromStoreId:'a',toStoreId:'b'}),true);
 for(const value of [null,{}, {id:'fake',from_store_id:'a',to_store_id:'b'}, {id,from_store_id:'a',to_store_id:'other'}])assert.equal(attempts.isConfirmedTransfer(value,{fromStoreId:'a',toStoreId:'b'}),false);
});

test('only definite write rejections can release checkout and receipt identities',()=>{
 for(const result of [{},{status:200},{status:408},{status:409},{status:409,code:'REQUEST_FAILED'},{status:409,code:'IDEMPOTENCY_CONFLICT'},{status:425},{status:429},{status:500}])assert.equal(isDefiniteWriteRejection(result),false,JSON.stringify(result));
 for(const result of [{status:400,code:'VALIDATION_ERROR'},{status:401},{status:403},{status:409,code:'INSUFFICIENT_STOCK'}])assert.equal(isDefiniteWriteRejection(result),true,JSON.stringify(result));
});
test('uncertain checkout retains immutable packet across restart and cannot start another sale',()=>{
 const s=storage(),key=attemptKey('org','branch','cashier','sale');
 const first=beginAttempt(s,key,{clientReference:'POS-one',payload:{id:'POS-one',items:[{id:'product',quantity:1}]}});
 assert.equal(first.state,'pending');
 assert.equal(beginAttempt(s,key,{clientReference:'POS-two',payload:{id:'POS-two'}}).clientReference,'POS-one');
 assert.equal(readAttempt(s,key).payload.items[0].quantity,1);
 assert.notEqual(key,attemptKey('org','branch','other','sale'));
 settleAttempt(s,key,'unknown');assert.equal(readAttempt(s,key).state,'unknown');
 settleAttempt(s,key,'confirmed');assert.equal(readAttempt(s,key),null);
});
test('storage failure blocks write; definite rejection releases persisted attempt',()=>{
 assert.throws(()=>beginAttempt({getItem:()=>null,setItem:()=>{throw Error('quota')}},'key',{clientReference:'a',payload:{}}));
 const s=storage();beginAttempt(s,'key',{clientReference:'a',payload:{}});settleAttempt(s,'key','rejected');assert.equal(readAttempt(s,'key'),null);
});
test('malformed success responses never confirm financial writes',()=>{
 for(const data of [null,{}, {id:'POS-client',sale_number:'a'},{receiptId:'client',updated:[]}]){assert.equal(isConfirmedSale(data),false);assert.equal(isConfirmedReceipt(data),false)}
 const id='00000000-0000-4000-8000-000000000001';assert.equal(isConfirmedSale({id,sale_number:'S-1'}),true);assert.equal(isConfirmedReceipt({receiptId:id,updated:[{productId:id,quantity:1}]}),true);
});
