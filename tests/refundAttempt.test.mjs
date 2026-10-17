import test from 'node:test';import assert from 'node:assert/strict';
import * as attempt from '../src/utils/refundAttempt.js';
test('lost-response refund identity survives retry and refresh until acknowledged',()=>{
 assert.equal(typeof attempt.refundReference,'function');
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 const key=attempt.refundAttemptKey('tenant','cashier','branch','sale','product');
 const first=attempt.refundReference(storage,key,'1:cash:broken');
 assert.equal(attempt.refundReference(storage,key,'1:cash:broken'),first);
 assert.throws(()=>attempt.refundReference(storage,key,'2:cash:broken'));
 assert.notEqual(attempt.refundAttemptKey('other','cashier','branch','sale','product'),key);
 attempt.acknowledgeRefund(storage,key);assert.notEqual(attempt.refundReference(storage,key,'1:cash:broken'),first);
});
test('definite rejection releases identity while uncertain responses retain it',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 attempt.refundReference(storage,'key','first');
 attempt.rejectRefund(storage,'key',{status:500});assert.ok(map.has('key'));
 attempt.rejectRefund(storage,'key',{status:409,code:'IDEMPOTENCY_CONFLICT'});assert.ok(map.has('key'));
 attempt.rejectRefund(storage,'key',{status:400,code:'VALIDATION_ERROR'});assert.equal(map.has('key'),false);
 assert.ok(attempt.refundReference(storage,'key','corrected'));
});

test('timeout and generic conflict preserve financial identity for retry',()=>{
 for(const result of [{status:408},{status:409,code:'REQUEST_FAILED'},{status:425},{status:429}]){
  const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
  const first=attempt.refundReference(storage,'key','intent');
  attempt.rejectRefund(storage,'key',result);
  assert.equal(attempt.refundReference(storage,'key','intent'),first,JSON.stringify(result));
 }
});

test('refund retry reuses its exact payload after refresh, midnight or shift change',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 const reference=attempt.refundReference(storage,'key','1:original:broken');
 const original={clientReference:reference,productId:'product',quantity:1,reason:'broken',refundMethod:'original',refundShiftId:'shift-a',metadata:{dateISO:'2026-10-18'}};
 assert.deepEqual(attempt.refundPayload(storage,'key',original),original);
 assert.deepEqual(attempt.refundPayload(storage,'key',{...original,refundShiftId:'shift-b',metadata:{dateISO:'2026-10-19'}}),original);
 assert.throws(()=>attempt.refundPayload(storage,'key',{...original,clientReference:'different'}));
});

test('an incomplete success cannot acknowledge a financial refund',()=>{
 for(const row of [undefined,{}, {id:'client-reference',amount:100},{id:'11111111-1111-4111-8111-111111111111'},{id:'11111111-1111-4111-8111-111111111111',amount:null}])assert.equal(attempt.isConfirmedRefund(row),false);
 assert.equal(attempt.isConfirmedRefund({id:'11111111-1111-4111-8111-111111111111',amount:'100.00'}),true);
});
