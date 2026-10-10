import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {JSDOM} from 'jsdom';import {MemoryRouter} from 'react-router-dom';import {createServer} from 'vite';import {posDraftKey,savePosDraft,readPosDraft} from '../src/utils/posDraft.js';
test('late checkout cannot erase newly selected branch draft; 1/10/30/100 lines restore',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,act:globalThis.IS_REACT_ACT_ENVIRONMENT,raf:globalThis.requestAnimationFrame};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});let root;
 try{
  const [{AuthProvider},{StoreProvider,useStore},{FeedbackProvider},{default:Sales},{api},{createRoot}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx'),vite.ssrLoadModule('/src/pages/sales/Sales.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const products=Array.from({length:100},(_,i)=>({id:`product-${i}`,name:`Apple ${i}`,sellPrice:100,quantity:10,stockByStore:{[a]:10,[b]:10}}));
  const keyA=posDraftKey('org','owner',a),keyB=posDraftKey('org','owner',b);
  savePosDraft(dom.window.localStorage,keyA,{cart:[{id:products[0].id,cartQty:1}],payment:'card',checkoutReference:'POS-stable'});
  savePosDraft(dom.window.localStorage,keyB,{cart:products.map(item=>({id:item.id,cartQty:1})),payment:'card'});
  let preferredStore=a; api.get=async path=>{
   if(path==='/api/auth/me')return {user:{id:'owner',organizationId:'org',appRole:'OWNER'}};
   if(path==='/api/bootstrap')return {stores:[{id:a,name:'A',active:true},{id:b,name:'B',active:true}],inventory:products,organization:{id:'org',plan:'MONTHLY',storeLimit:2},activeShifts:{[a]:{id:a},[b]:{id:b}}};
   if(path==='/api/settings')return {selectedStoreId:preferredStore,workspaceSettings:{pos:{defaultPayment:'card'}},rolePermissions:{},uiPreferences:{},businessFeatures:{}};
   return {users:[],sessions:[],holds:[],revision:'1'};
  };api.patch=async(path,body)=>{if(body.selectedStoreId)preferredStore=body.selectedStoreId;return {}};
  let release,submitted=0;const pending=new Promise(resolve=>release=resolve);api.post=async()=>{submitted++;return pending};
  let store;const Probe=()=>{store=useStore();return null};const container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,React.createElement(Probe),React.createElement(Sales)))))));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,300)));
  assert.equal(container.querySelectorAll('.cart-item').length,1);
  await act(async()=>container.querySelector('.checkout-primary').click());assert.equal(submitted,1);
  await act(async()=>store.setSelectedStoreId(b));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  assert.equal(container.querySelectorAll('.cart-item').length,100);
  assert.equal(container.querySelector('.checkout-primary').closest('.pos-checkout-scroll'),null);
  assert.equal(container.querySelector('.cart-list').getAttribute('aria-label'),'Savat mahsulotlari');
  await act(async()=>release({sale:{id:'33333333-3333-4333-8333-333333333333',saleNumber:'S-1'}}));
  assert.equal(container.querySelectorAll('.cart-item').length,100);
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));assert.equal(readPosDraft(dom.window.localStorage,keyB).cart.length,100);assert.equal(readPosDraft(dom.window.localStorage,keyA),null);
  api.post=async()=>{const error=new Error('Savatni tekshiring');error.status=400;throw error};
  await act(async()=>container.querySelector('[aria-label="Savatni ushlab turish"]').click());
  await act(async()=>Array.from(container.querySelectorAll('.hold-row button')).find(button=>button.textContent.trim()==='Savatni ushlab turish').click());
  assert.equal(container.querySelectorAll('.cart-item').length,100,'server hold error retains active cart');
  for(const count of [10,30]){
   await act(async()=>store.setSelectedStoreId(a));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
   savePosDraft(dom.window.localStorage,keyB,{cart:products.slice(0,count).map(item=>({id:item.id,cartQty:1})),payment:'card'});
   await act(async()=>store.setSelectedStoreId(b));await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));assert.equal(container.querySelectorAll('.cart-item').length,count);
  }
 }finally{
  if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;globalThis.requestAnimationFrame=old.raf;Object.defineProperty(globalThis,'navigator',{value:old.navigator,configurable:true});
 }
});
