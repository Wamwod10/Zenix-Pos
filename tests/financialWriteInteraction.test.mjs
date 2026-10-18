import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {JSDOM} from 'jsdom';import {createServer} from 'vite';
import {attemptKey,readAttempt,beginFinancialAttempt} from '../src/utils/checkoutAttempt.js';

test('supplier and expense requests survive malformed responses, refresh and shifted retries',{timeout:30000},async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});let root;
 try{
  const [{AuthProvider},{StoreProvider,useStore},{api},{createRoot}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
  const branch='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
  api.get=async path=>path==='/api/auth/me'?{user:{id:'owner',organizationId:'org',appRole:'OWNER'}}:path==='/api/bootstrap'?{stores:[{id:branch,name:'A',active:true}],inventory:[],organization:{id:'org',plan:'MONTHLY',storeLimit:2,licenseStatus:'ACTIVE',accessMode:'READ_WRITE'},activeShifts:{[branch]:{id:branch}}}:path==='/api/settings'?{selectedStoreId:branch,workspaceSettings:{},rolePermissions:{},uiPreferences:{},businessFeatures:{}}:{users:[],sessions:[],revision:'1'};
  let store;const Probe=()=>{store=useStore();return null};root=createRoot(document.getElementById('root'));
  const mount=()=>React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(Probe)));
  await act(async()=>root.render(mount()));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  for(const operation of ['supplier','expense']){
   const sent=[];api.post=async(_path,body)=>{sent.push(structuredClone(body));return sent.length===1?{}:{[operation==='supplier'?'payment':'expense']:{id,amount:'10.00'}}};
   const expense={id:'local-1',storeId:branch,shiftId:branch,title:'Transport',amount:10,paymentMethod:'cash',dateISO:'2026-10-18'};
   const invoke=()=>operation==='supplier'?store.commitSupplierPayment({supplierId:id,amount:10,method:'cash',payFromRegister:true}):store.commitExpenseTransaction({expense});
   let result;await act(async()=>{result=await invoke()});assert.equal(result.success,false,'incomplete response is not acknowledged');
   const key=attemptKey('org',branch,'owner',operation==='supplier'?`supplier-payment:${id}`:'expense-create');
   assert.ok(readAttempt(dom.window.localStorage,key)?.payload.clientReference);
   // Unmount/remount represents a page refresh; the journal remains in localStorage.
   await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(mount()));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
   await act(async()=>{result=await invoke()});assert.equal(result.success,true);assert.deepEqual(sent[1],sent[0]);assert.equal(readAttempt(dom.window.localStorage,key),null);
  }
  const [{default:Suppliers},{FeedbackProvider}]=await Promise.all([vite.ssrLoadModule('/src/pages/suppliers/Suppliers.jsx'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx')]);
  const key=attemptKey('org',branch,'owner',`supplier-payment:${id}`);
  const packet=beginFinancialAttempt(dom.window.localStorage,key,{invoiceId:null,storeId:branch,shiftId:null,fromRegister:false,amount:10,method:'card',note:''});
  const previousGet=api.get;api.get=async path=>path==='/api/bootstrap'?{...await previousGet(path),suppliers:[{id,name:'Supplier',debt:0,purchaseHistory:[]}]}:previousGet(path);
  let release;const pending=new Promise(resolve=>release=resolve);const submitted=[];api.post=async(_path,body)=>{submitted.push(body);return pending};
  await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(Suppliers))))));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  const open=[...document.querySelectorAll('.supplier-actions button')].find(button=>button.textContent.trim()==='To‘lov');assert.ok(open,document.body.textContent.slice(0,1400));assert.equal(open.disabled,false,'zero remaining debt must not prevent reconciliation');
  await act(async()=>open.click());const retry=[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.trim()==='To‘lovni tekshirish');assert.ok(retry);assert.equal(retry.disabled,false);
  await act(async()=>{retry.click();retry.click()});assert.equal(submitted.length,1,'double click is blocked before dispatch');assert.deepEqual(submitted[0],packet.payload);
  await act(async()=>release({payment:{id,amount:10}}));assert.equal(readAttempt(dom.window.localStorage,key),null);
 }finally{if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;Object.defineProperty(globalThis,'navigator',{value:old.navigator,configurable:true})}
});
