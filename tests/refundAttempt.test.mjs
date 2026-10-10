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
