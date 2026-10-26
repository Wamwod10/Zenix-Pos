import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {z} from '../../backend/node_modules/zod/index.js';
import {recordCustomerRepayment} from '../../backend/src/services/customerRepayments.js';
import {assertFilePurposeWrite} from '../../backend/src/services/fileAssets.js';
import {requestFingerprint} from '../../backend/src/services/posReplay.js';
import {buildCustomerPaymentPayload} from '../src/pages/customers/customerState.js';

// Boundary tests execute the real old payload builder/schema and current guards.
// They are not a substitute for browser acceptance against both deployed versions.
const git=process.env.GIT_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Git/cmd/git.exe':'git');
const frontend=fileURLToPath(new URL('..',import.meta.url)).replace(/\\/g,'/');
const backend=fileURLToPath(new URL('../../backend',import.meta.url)).replace(/\\/g,'/');
const old=(repo,revision,file)=>execFileSync(git,['-c',`safe.directory=${repo}`,'-C',repo,'show',`${revision}:${file}`],{encoding:'utf8'});
const oldState=await import('data:text/javascript;base64,'+Buffer.from(old(frontend,'f5eae0e','src/pages/customers/customerState.js')).toString('base64'));
const oldCustomers=old(backend,'b41bd55','src/routes/customers.js');
const oldProducts=old(backend,'b41bd55','src/routes/products.js');

test('atomic bulk client requires the matching backend batch endpoint',()=>{
 assert.doesNotMatch(oldProducts,/router\.post\(['"]\/bulk['"]/);
});
const schemaExpression=oldCustomers.match(/const paymentSchema=(.*);\r?\n/)[1];
const oldPaymentSchema=new Function('z','roundMoney',`return ${schemaExpression}`)(z,v=>Math.round(v*100)/100);
const input={amount:100,paymentMethod:'cash',storeId:'11111111-1111-4111-8111-111111111111',shiftId:'22222222-2222-4222-8222-222222222222',clientReference:'stable-ref'};
const user={id:'actor',organizationId:'org',appRole:'OWNER'};

test('old frontend cash payload is rejected by new backend before financial writes',async()=>{
 const payload=oldState.buildCustomerPaymentPayload(input);assert.equal(payload.shiftId,undefined);
 const calls=[],client={query:async sql=>{calls.push(sql);return {rows:[]}}};
 await assert.rejects(recordCustomerRepayment(client,{user,customerId:'customer',storeId:input.storeId,input:payload}),e=>e.code==='SHIFT_REQUIRED');
 assert.ok(calls.every(sql=>!sql.includes('INSERT')));
});
test('old frontend upload omits purpose required by new backend',()=>{
 assert.doesNotMatch(old(frontend,'f5eae0e','src/services/apiClient.js'),/X-File-Purpose/i);
 assert.throws(()=>assertFilePurposeWrite(user,undefined),e=>e.code==='FILE_PURPOSE_REQUIRED');
});
test('new frontend plus old backend silently loses cash shift provenance',()=>{
 const payload=buildCustomerPaymentPayload(input),parsed=oldPaymentSchema.parse(payload);
 assert.equal(payload.shiftId,input.shiftId);assert.equal(parsed.shiftId,undefined);
 assert.doesNotMatch(oldCustomers,/customer_payment_ledger_id|INSERT INTO shift_movements/);
 assert.doesNotMatch(old(backend,'b41bd55','src/routes/shifts.js'),/\/summary/);
});
test('cross-version completed cash retries cannot be assumed fingerprint-compatible',()=>{
 const current=buildCustomerPaymentPayload(input),legacy=oldPaymentSchema.parse(current);
 const fingerprint=value=>requestFingerprint({customerId:'customer',userId:user.id,...value,storeId:input.storeId});
 assert.notEqual(fingerprint(current),fingerprint(legacy));
});
test('already committed legacy cash payload replays through new backend without fabricating drawer cash',async()=>{
 const payload=oldPaymentSchema.parse(oldState.buildCustomerPaymentPayload(input));
 const previous={id:'legacy-payment',customer_id:'customer',metadata:{fingerprint:requestFingerprint({customerId:'customer',userId:user.id,...payload,storeId:input.storeId})}};
 const calls=[],client={query:async sql=>{calls.push(sql);return {rows:sql.includes('FROM customer_ledger')?[previous]:[]}}};
 assert.equal(await recordCustomerRepayment(client,{user,customerId:'customer',storeId:input.storeId,input:payload}),previous);
 assert.equal(calls.length,2);assert.ok(calls.every(sql=>!sql.includes('INSERT')));
});
