import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
test('remote POS resolves a persisted unloaded product before exposing a partial cache',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const previous={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
 const vite=await createServer({cacheDir:'.cache/vite-pos-workspace-test',server:{middlewareMode:true},appType:'custom',logLevel:'silent'});let root;
 try{
  const [{AuthProvider},{StoreProvider,useStore},{default:PosWorkspace},{api},{createRoot}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/context/PosWorkspace.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
  const store='11111111-1111-4111-8111-111111111111',key=`zenix:pos-draft:v1:org:owner:${store}`,draft={v:1,cart:[{id:'last',cartQty:2}]};
  window.localStorage.setItem(key,JSON.stringify(draft));let resolveDraft,coreHeader=false,state,outer,mounts=0,refuseFull=true;
  api.get=async(endpoint,options)=>{
   if(endpoint==='/api/auth/me')return {user:{id:'owner',organizationId:'org',name:'Owner',appRole:'OWNER'}};
   if(endpoint==='/api/settings')return {};
   if(endpoint==='/api/bootstrap'){coreHeader=options?.headers?.['x-zenix-bootstrap']==='core';const partial=coreHeader||refuseFull;return {...(partial?{catalog:{complete:false,mode:'remote-v1'}}:{}),inventory:partial?[]:[{id:'last',stockByStore:{[store]:1.25}}],stores:[{id:store,name:'Test'}],organization:{id:'org',licenseStatus:'ACTIVE',expiryDate:'2099-01-01'}}}
   if(endpoint.startsWith('/api/bootstrap/catalog?')){
    const q=new URL(endpoint,'http://localhost').searchParams;
    if(q.has('ids'))return await new Promise(resolve=>{resolveDraft=resolve});
    return {products:[{id:'first',name:'First',stockByStore:{[store]:7}}],categories:[],hasMore:true,nextCursor:'page2'};
   }
   return {revision:'1',users:[],holds:[]};
  };
  function Probe(){state=useStore();React.useEffect(()=>{mounts++},[]);return React.createElement('span',{'data-pos':'ready'},state.inventory.map(p=>p.id).join(','))}
  function Gate(){const base=useStore();outer=base;return base.workspaceReady&&base.stores.length?React.createElement(PosWorkspace,null,React.createElement(Probe)):null}
  root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(Gate))))));
  await act(async()=>{await new Promise(r=>setTimeout(r,30))});assert.ok(coreHeader);assert.equal(document.querySelector('[data-pos]'),null);assert.deepEqual(JSON.parse(window.localStorage.getItem(key)),draft);
  await act(async()=>{resolveDraft({products:[{id:'last',name:'Last',sellPrice:12.34,stockByStore:{[store]:'1.250'},metadata:{packaging:[{unit:'box',factor:12,salePrice:120}]},serializedUnits:[{serial:'S'}]}],missingIds:[]});await new Promise(r=>setTimeout(r,20))});
  assert.equal(state.catalogComplete,false);assert.equal(state.inventory.length,2);assert.equal(state.getStoreStock('last',store),1.25);assert.equal(state.getStoreProduct('last',store).serializedUnits[0].serial,'S');assert.throws(()=>state.getStoreStock('unknown',store),/tekshirilmagan/);assert.deepEqual(JSON.parse(window.localStorage.getItem(key)),draft);
  const node=document.querySelector('[data-pos]'),initialMounts=mounts;
  await act(async()=>{await assert.rejects(outer.ensureCatalog(),/Complete catalog/)});assert.equal(outer.catalogComplete,false);
  refuseFull=false;await act(async()=>{await outer.ensureCatalog()});
  assert.equal(mounts,initialMounts);assert.equal(document.querySelector('[data-pos]'),node,'full snapshot completion must not remount a cashier');
  assert.equal(state.catalogComplete,false,'the POS detail cache remains partial even when the outer legacy snapshot completes');
 }finally{
  if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;Object.defineProperty(globalThis,'navigator',{configurable:true,value:previous.navigator});
 }
});
