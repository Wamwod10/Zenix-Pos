import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {MemoryRouter} from 'react-router-dom';

test('branch choice survives failed preference writes, refresh and page reload', async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT,fetch:globalThis.fetch,resize:globalThis.ResizeObserver,frame:globalThis.requestAnimationFrame,cancelFrame:globalThis.cancelAnimationFrame};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
  dom.window.HTMLElement.prototype.getBoundingClientRect=()=>({width:800,height:300,top:0,left:0,right:800,bottom:300,x:0,y:0,toJSON(){}});
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
  let root;
  try{
    const [{AuthProvider},{StoreProvider,useStore},{api},{createRoot},{FeedbackProvider}]=await Promise.all([
      vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx')]);
    let settingsFail=false;
    let auditDelay=false,auditResolve;
    const requests=[];
    const writes=[];
    api.get=async path=>{
      if(path==='/api/auth/me')return {user:{id:'owner',organizationId:'org',appRole:'OWNER'}};
      if(path==='/api/bootstrap')return {stores:[{id:'a',name:'Main'},{id:'b',name:'Empty'}],inventory:[{id:'product',metadata:{quantity:20},stock_by_store:{a:20}}],organization:{id:'org'}};
      if(path==='/api/settings'){if(settingsFail)throw new Error('502');return {selectedStoreId:'a',businessFeatures:{branchSentinel:true}};}
      if(path.startsWith('/api/audit?')){
        const branch=new URL(path,'http://localhost').searchParams.get('storeId');requests.push(branch);
        if(auditDelay&&branch==='b')return new Promise(resolve=>{auditResolve=resolve});
        return {items:branch==='a'?[{id:'event',storeId:'a',type:'sale',title:'Main event',createdAt:new Date().toISOString()}]:[],hasMore:false};
      }
      return {revision:1,users:[],sessions:[]};
    };
    api.patch=async path=>{writes.push(path);if(path==='/api/settings/workspace')return {};throw new Error('502')};
    let store;
    function Probe(){store=useStore();return null;}
    function ReadyPage({Page}){const state=useStore();return state.workspaceReady&&state.stores.length&&Page?React.createElement(Page):null;}
    const mount=async(Page)=>{root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,React.createElement(Probe),React.createElement(ReadyPage,{Page})))))));};
    await mount();
    assert.equal(store.currentStoreId,'a');
    await act(async()=>store.setSelectedStoreId('b'));
    await act(async()=>store.reloadStore());
    assert.equal(store.currentStoreId,'b');
    assert.equal(store.inventory[0].quantity,0);
    assert.equal(store.getStoreProduct('product','unknown').quantity,0,'a missing branch balance must never use another branch snapshot');
    settingsFail=true;
    await act(async()=>store.reloadStore({silent:true}));
    assert.equal(store.businessFeatures.branchSentinel,true,'a failed background settings read must preserve successfully loaded configuration');
    settingsFail=false;
    await act(async()=>root.unmount());root=null;
    await mount();
    assert.equal(store.currentStoreId,'b');
    await act(async()=>root.unmount());root=null;
    globalThis.fetch=async url=>{
      const query=new URL(String(url),'http://localhost').searchParams;
      requests.push(query.get('storeId'));
      return new Response(JSON.stringify({ok:true,data:{sales:[],returns:[],expenses:[],aggregate:{netRevenue:0,grossProfit:0,refundAmount:0,expenseTotal:0,saleCount:0,cashflow:{cash:0,card:0,transfer:0}},pagination:{total:0,returnTotal:0,hasMore:false,offset:0,limit:500}}}),{headers:{'content-type':'application/json'}});
    };
    for(const name of ['analytics/Analytics','dashboard/Dashboard','history/History','sellerAnalytics/SellerAnalytics','activityLog/ActivityLog']){
      const {default:Page}=await vite.ssrLoadModule(`/src/pages/${name}.jsx`);
      requests.length=0;await mount(Page);
      assert.ok(requests.length>0,name);
      assert.deepEqual([...new Set(requests)],['b'],`${name} must initially request only the selected empty branch`);
      requests.length=0;await act(async()=>store.setSelectedStoreId('a'));
      assert.ok(requests.length>0,name);
      assert.ok(requests.every(id=>id==='a'),`${name} must follow the header branch selection`);
      if(name==='activityLog/ActivityLog')auditDelay=true;
      requests.length=0;await act(async()=>store.setSelectedStoreId('b'));
      assert.ok(requests.length>0,name);
      assert.ok(requests.every(id=>id==='b'),`${name} must return to the empty branch`);
      if(auditDelay){
        assert.deepEqual([...document.querySelectorAll('.activity-summary strong')].map(node=>node.textContent),['0','0','0','0'],'new branch must not show old audit counts while its response is pending');
        await act(async()=>auditResolve({items:[],hasMore:false}));auditDelay=false;
      }
      await act(async()=>root.unmount());root=null;
    }
    settingsFail=true;writes.length=0;
    await mount();
    await act(async()=>new Promise(resolve=>setTimeout(resolve,450)));
    assert.equal(store.workspaceReady,true,'bootstrap entitlements remain available');
    assert.equal(writes.includes('/api/settings/workspace'),false,'failed settings reads must never overwrite server configuration with defaults');
  }finally{
    if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();
    globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;
    globalThis.fetch=previous.fetch;globalThis.ResizeObserver=previous.resize;
    globalThis.requestAnimationFrame=previous.frame;globalThis.cancelAnimationFrame=previous.cancelFrame;
  }
});
