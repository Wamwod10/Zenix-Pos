import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {JSDOM} from 'jsdom';import {MemoryRouter} from 'react-router-dom';import {createServer} from 'vite';import {posDraftKey,savePosDraft,readPosDraft} from '../src/utils/posDraft.js';
test('cash tender follows totals, retains custom amounts and customer lookup consumes paginated results',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,act:globalThis.IS_REACT_ACT_ENVIRONMENT,raf:globalThis.requestAnimationFrame};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});let root;
 try{
  const [{AuthProvider},{StoreProvider,useStore},{FeedbackProvider},{default:Sales},{api},{createRoot}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx'),vite.ssrLoadModule('/src/pages/sales/Sales.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const products=Array.from({length:100},(_,i)=>({id:`product-${i}`,name:`Apple ${i}`,sellPrice:100,quantity:10,metadata:{packaging:i===0?[{unit:'quti',factor:3,salePrice:250}]:[]},stockByStore:{[a]:10,[b]:10}}));
  const keyA=posDraftKey('org','owner',a),keyB=posDraftKey('org','owner',b);
  savePosDraft(dom.window.localStorage,keyA,{cart:[{id:products[0].id,cartQty:1}],payment:'cash',checkoutReference:'POS-stable'});
  savePosDraft(dom.window.localStorage,keyB,{cart:products.map(item=>({id:item.id,cartQty:1})),payment:'cash'});
  let preferredStore=a; api.get=async path=>{
   if(path.startsWith('/api/customers?'))return {items:[{id:'customer-1',name:'Aziza',phone:'+998 (90) 123-45-67'}]};
   if(path==='/api/auth/me')return {user:{id:'owner',organizationId:'org',appRole:'OWNER'}};
   if(path==='/api/bootstrap')return {stores:[{id:a,name:'A',active:true},{id:b,name:'B',active:true}],inventory:products,organization:{id:'org',plan:'MONTHLY',storeLimit:2},activeShifts:{[a]:{id:a},[b]:{id:b}}};
   if(path==='/api/settings')return {selectedStoreId:preferredStore,workspaceSettings:{pos:{defaultPayment:'card'}},rolePermissions:{},uiPreferences:{},businessFeatures:{}};
   return {users:[],sessions:[],holds:[],revision:'1'};
  };api.patch=async(path,body)=>{if(body.selectedStoreId)preferredStore=body.selectedStoreId;return {}};
  let release,submitted=0;const pending=new Promise(resolve=>release=resolve);api.post=async()=>{submitted++;return pending};
  let store;const Probe=()=>{store=useStore();return null};const container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,React.createElement(Probe),React.createElement(Sales)))))));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,300)));
  const tender=()=>container.querySelector('.cash-box input');
  const digits=()=>tender().value.replace(/[^0-9]/g,'');
  assert.equal(digits(),'100');assert.equal(container.querySelector('.checkout-primary').disabled,false);
  const inputValue=async(input,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});};
  // Adding the same catalog item changes the cart total immediately.
  const productButton=Array.from(container.querySelectorAll('button')).find(button=>button.textContent.includes('Apple 0')&&!button.closest('.cart-item'));
  assert.ok(productButton);await act(async()=>productButton.click());assert.equal(digits(),'200');
  await inputValue(tender(),'100');assert.equal(container.querySelector('.checkout-primary').disabled,true);
  await inputValue(tender(),'');assert.equal(digits(),'200');assert.equal(container.querySelector('.checkout-primary').disabled,false);
  await inputValue(tender(),'500');assert.equal(digits(),'500');assert.match(container.querySelector('.cash-box').textContent,/300/);
  await act(async()=>productButton.click());assert.equal(digits(),'500');assert.match(container.querySelector('.cash-box').textContent,/200/);
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));assert.equal(readPosDraft(dom.window.localStorage,keyA).cashTendered,'500');
  await act(async()=>store.setSelectedStoreId(b));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));assert.equal(digits(),'10000');
  await act(async()=>store.setSelectedStoreId(a));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));assert.equal(digits(),'500');
  await inputValue(tender(),'1000');
  const packageSelect=()=>container.querySelector('.cart-item .premium-select');
  await act(async()=>packageSelect().click());await act(async()=>Array.from(document.querySelectorAll('[role=option]')).find(option=>option.textContent.startsWith('quti')).click());
  assert.equal(container.querySelector('.qty-value').textContent,'3');assert.match(container.querySelector('.cash-box').textContent,/250/);assert.equal(container.querySelector('[aria-label="Miqdorni oshirish"]').disabled,true);
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));const packedDraft=readPosDraft(dom.window.localStorage,keyA);assert.equal(packedDraft.cart[0].cartQty,9);assert.equal(packedDraft.cart[0].packUnit,'quti');
  await act(async()=>store.setSelectedStoreId(b));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));await act(async()=>store.setSelectedStoreId(a));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));assert.match(packageSelect().textContent,/quti/);assert.equal(container.querySelector('.qty-value').textContent,'3');
  await act(async()=>container.querySelector('[aria-label="Miqdorni kamaytirish"]').click());assert.equal(container.querySelector('.qty-value').textContent,'2');assert.match(container.querySelector('.cash-box').textContent,/500/);
  const customerInput=container.querySelector('.pos-customer-selector input');await act(async()=>customerInput.focus());await inputValue(customerInput,'Az');
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));const option=container.querySelector('.pos-customer-results button');assert.equal(option.querySelector('strong').textContent,'Aziza');await act(async()=>option.click());assert.equal(customerInput.value,'Aziza');
  await act(async()=>container.querySelector('.checkout-primary').click());assert.equal(submitted,1);
  await act(async()=>release({sale:{id:'33333333-3333-4333-8333-333333333333',saleNumber:'S-1'}}));assert.equal(digits(),'0');
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
 }finally{
  if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;globalThis.requestAnimationFrame=old.raf;Object.defineProperty(globalThis,'navigator',{value:old.navigator,configurable:true});
 }
});
