import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ROLES,canAdministerStaff,buildStaffRolePatch} from '../src/config/roles.js';

test('staff UI preserves OWNER/ADMIN hierarchy independently of an explicit module grant',()=>{
 for(const actor of [ROLES.ADMIN,ROLES.MANAGER,ROLES.CASHIER,ROLES.SALES,ROLES.WAREHOUSE,ROLES.PLATFORM_ADMIN]){
  assert.equal(canAdministerStaff(actor,ROLES.OWNER),false);
  assert.equal(canAdministerStaff(actor,ROLES.ADMIN),false);
 }
 assert.equal(canAdministerStaff(ROLES.OWNER,ROLES.OWNER),true);
 assert.equal(canAdministerStaff(ROLES.OWNER,ROLES.ADMIN),true);
 assert.equal(canAdministerStaff(ROLES.ADMIN,ROLES.MANAGER),true);
 assert.equal(canAdministerStaff(undefined,ROLES.MANAGER),false);
});

test('delegated staff role changes omit owner-only permission override writes',()=>{
 assert.deepEqual(buildStaffRolePatch(ROLES.ADMIN,ROLES.SALES),{appRole:ROLES.SALES,role:'sales'});
 assert.deepEqual(buildStaffRolePatch(ROLES.OWNER,ROLES.SALES),{appRole:ROLES.SALES,role:'sales',permissionOverrides:{}});
});

const source=fs.readFileSync(new URL('../src/context/StoreContext.jsx',import.meta.url),'utf8');
const body=source.slice(source.indexOf('const patchProducts=useCallback'),source.indexOf('const addStore = useCallback'));
function harness(post){
 let state=[{id:'a',category:'old',stockByStore:{s:7},costByStore:{s:0},serializedUnits:['serial'],stockBatches:['batch']},{id:'b',category:'old'}];
 const context={useCallback:fn=>fn,api:{post},stores:[{id:'s'}],productFromApi:row=>row,setInventoryState:update=>{state=update(state)},apiFailure:error=>({success:false,message:error.message})};
 const patch=vm.runInNewContext(body.replace('const patchProducts=','globalThis.patchProducts='),context);
 return {patch,state:()=>state};
}
test('bulk failure makes one request and preserves every local row',async()=>{
 const calls=[];const h=harness(async(path,body)=>{calls.push({path,body});throw Error('transaction rejected')});
 const before=structuredClone(h.state());assert.equal((await h.patch(['a','b','a'],{category:'new'})).success,false);
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/products/bulk');assert.deepEqual(Array.from(calls[0].body.productIds),['a','b']);assert.deepEqual(h.state(),before);
});
test('successful bulk response updates together without replacing branch/tracking state',async()=>{
 const h=harness(async()=>({products:[{id:'a',category:'new'},{id:'b',category:'new'}]}));
 assert.equal((await h.patch(['a','b'],{category:'new'})).success,true);
 assert.deepEqual(h.state().map(p=>p.category),['new','new']);assert.equal(h.state()[0].costByStore.s,0);assert.equal(h.state()[0].stockByStore.s,7);assert.deepEqual(h.state()[0].serializedUnits,['serial']);assert.deepEqual(h.state()[0].stockBatches,['batch']);
});
test('bulk undo sends different original values in one atomic request',async()=>{
 const calls=[];const h=harness(async(path,body)=>{calls.push({path,body});return {products:[{id:'a',category:'first'},{id:'b',category:'second'}]}});
 const updates=[{productId:'a',patch:{category:'first'}},{productId:'b',patch:{category:'second'}}];
 assert.equal((await h.patch(['a','b'],updates)).success,true);assert.equal(calls.length,1);assert.equal(calls[0].body.updates,updates);
 assert.deepEqual(h.state().map(row=>row.category),['first','second']);
});
