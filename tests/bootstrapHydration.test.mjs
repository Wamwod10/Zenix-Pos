import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('complete inventory commits atomically even if independent settings fails',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const previous={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});let root;
 try{
  const [{AuthProvider,useAuth},{StoreProvider,useStore},{api},{createRoot}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
  const store='11111111-1111-4111-8111-111111111111',observed=[];
  api.get=async endpoint=>{
   if(endpoint==='/api/auth/me')return {user:{id:'owner',organizationId:'org',name:'Owner',appRole:'OWNER'}};
   if(endpoint==='/api/settings')throw new Error('Synthetic settings failure');
   if(endpoint==='/api/bootstrap')return {stores:[{id:store,name:'Test'}],organization:{id:'org',licenseStatus:'ACTIVE',expiryDate:'2099-01-01'},inventory:Array.from({length:1001},(_,i)=>({id:String(i),name:'Rice '+i,sellPrice:12.34,stockByStore:{[store]:'1.250'},serializedUnits:[{serial:'SER-'+i}],stockBatches:[]}))};
   return {users:[],sessions:[],revision:'1'};
  };
  const Probe=()=>{const state=useStore(),user=useAuth().currentUser;observed.push({authorized:Boolean(user?.organizationId),ready:state.workspaceReady,count:state.inventory.length});return React.createElement('span',{'data-ready':state.workspaceReady},state.inventory.length);};
  root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(Probe)))));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,80));});
  assert.equal(document.querySelector('[data-ready=true]')?.textContent,'1001');
  assert.ok(observed.some(x=>!x.ready));assert.ok(observed.filter(x=>x.authorized&&x.ready).every(x=>x.count===1001));
 }finally{
  if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:previous.navigator});
 }
});
