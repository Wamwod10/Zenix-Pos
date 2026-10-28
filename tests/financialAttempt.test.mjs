import test from 'node:test';
import assert from 'node:assert/strict';
import * as attempt from '../src/utils/checkoutAttempt.js';
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}};
test('a financial retry retains its exact request and reference across refresh and shift changes',()=>{
 const s=storage(),input={storeId:'branch',invoiceId:'invoice',amount:10,method:'cash',fromRegister:true,shiftId:'old',note:'debt'};
 const first=attempt.beginFinancialAttempt(s,'key',input);
 assert.ok(first.payload.clientReference);
 assert.deepEqual(attempt.beginFinancialAttempt(s,'key',{...input,shiftId:'new'}),first);
 for(const changed of [{amount:11},{invoiceId:'other'},{method:'card'},{note:'changed'}])assert.throws(()=>attempt.beginFinancialAttempt(s,'key',{...input,...changed}));
 attempt.settleAttempt(s,'key','confirmed');assert.notEqual(attempt.beginFinancialAttempt(s,'key',input).clientReference,first.clientReference);
});
test('incomplete or invalid money records cannot acknowledge a financial write',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 for(const value of [undefined,{}, {id},{id,amount:null},{id,amount:''},{id,amount:false},{id,amount:-1},{id:'client-ref',amount:10}])assert.equal(attempt.isConfirmedFinancialRecord(value),false);
 assert.equal(attempt.isConfirmedFinancialRecord({id,amount:'10.00'}),true);
});

test('concurrent tabs share one reference and a late acknowledgement cannot erase a newer request',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let queue=Promise.resolve();
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(_key,action)=>{const next=queue.then(action);queue=next.catch(()=>{});return next}}}});
 try{
  const s=storage(),payload={amount:10,method:'card'};
  const [a,b]=await Promise.all([attempt.prepareFinancialAttempt(s,'key',payload),attempt.prepareFinancialAttempt(s,'key',payload)]);
  assert.equal(a.clientReference,b.clientReference);
  assert.equal(await attempt.settleFinancialAttempt(s,'key',a.clientReference,'rejected'),'unknown','one rejected participant cannot erase another in-flight request');
  assert.equal(attempt.readAttempt(s,'key').clientReference,b.clientReference);
  await attempt.settleFinancialAttempt(s,'key',a.clientReference,'unknown');
  assert.equal(await attempt.settleFinancialAttempt(s,'key',b.clientReference,'rejected'),'unknown','one auth rejection cannot erase a lost committed response');
  await attempt.settleFinancialAttempt(s,'key',b.clientReference,'confirmed');
  const newer=await attempt.prepareFinancialAttempt(s,'key',{amount:20,method:'card'});
  await attempt.settleFinancialAttempt(s,'key',b.clientReference,'confirmed');
  assert.equal(attempt.readAttempt(s,'key').clientReference,newer.clientReference);
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator}
});

test('manual cash movement retry preserves one identifier and immutable signed intent',async()=>{
 const s=storage(),key=attempt.attemptKey('org','store','user','shift-movement');
 const original={shiftId:'shift-a',type:'in',amount:0.10,reason:'Register float',source:'manual'};
 const first=await attempt.prepareFinancialAttempt(s,key,original);
 assert.match(first.clientReference,/^FIN-/);
 assert.equal(attempt.readAttempt(s,key).payload.shiftId,'shift-a');
 await attempt.settleFinancialAttempt(s,key,first.clientReference,'unknown');
 const retry=await attempt.prepareFinancialAttempt(s,key,original);
 assert.equal(retry.clientReference,first.clientReference);
 assert.deepEqual(retry.payload,first.payload);
 for(const changed of [{amount:0.20},{reason:'Different cash'},{type:'out'}]){
  await assert.rejects(async()=>attempt.prepareFinancialAttempt(s,key,{...original,...changed}),/oldingi|tekshiring/i);
 }
 await attempt.settleFinancialAttempt(s,key,first.clientReference,'confirmed');
 assert.equal(attempt.readAttempt(s,key),null);
 const next=await attempt.prepareFinancialAttempt(s,key,original);
 assert.notEqual(next.clientReference,first.clientReference,'only confirmed attempt may create a new identifier');
});

test('Shift UI and StoreContext retry only a journaled reference, without double submit',async()=>{
 const {readFileSync}=await import('node:fs');
 const context=readFileSync(new URL('../src/context/StoreContext.jsx',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/pages/shifts/Shifts.jsx',import.meta.url),'utf8');
 for(const expression of ['prepareFinancialAttempt(window.localStorage,journalKey','referenceId:packet.clientReference','settleFinancialAttempt(window.localStorage,journalKey']){
  assert.ok(context.includes(expression),expression);
 }
 for(const expression of ['movementSubmittingRef.current','pendingCashMovement','readAttempt(window.localStorage,movementJournalKey)']){
  assert.ok(ui.includes(expression),expression);
 }
});
