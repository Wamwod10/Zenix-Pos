import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {workspaceAccessState} from '../src/utils/license.js';
import React,{act} from 'react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test("approved active organization immediately unlocks protected workspace routes", () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(workspaceAccessState({ organization: { licenseStatus: "ACTIVE", expiryDate: future } }).allowed, true);
});
test("pending payment does not keep an already active organization locked", () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(workspaceAccessState({
    organization: { licenseStatus: "ACTIVE", expiryDate: future },
    payments: [{ status: "REVIEW", type: "LICENSE" }],
  }).allowed, true);
});
test("review and payment-required organizations remain blocked", () => {
  assert.equal(workspaceAccessState({ organization: { licenseStatus: "REVIEW" } }).allowed, false);
  assert.equal(workspaceAccessState({ organization: { licenseStatus: "PAYMENT_REQUIRED" } }).allowed, false);
});
test("expired active organization remains blocked", () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  assert.deepEqual(workspaceAccessState({ organization: { licenseStatus: "ACTIVE", expiryDate: past } }).reason, "EXPIRED");
});
test("workspace hydration commits bootstrap entitlement even when settings refresh fails", () => {
  const source = fs.readFileSync(new URL("../src/context/StoreContext.jsx", import.meta.url), "utf8");
  assert.match(source, /Promise\.allSettled\(\[api\.get\("\/api\/bootstrap"\),api\.get\("\/api\/settings"\)\]\)/);
  assert.match(source, /if\(baseResult\.status!=="fulfilled"\)throw baseResult\.reason/);
  assert.match(source, /settingsResult\.status==="fulfilled"\?\(settingsResult\.value\|\|\{\}\):\{\}/);
});

test('free promo redemption leaves activation for the hydrated workspace',async()=>{
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true});
  const previous={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,act:globalThis.IS_REACT_ACT_ENVIRONMENT,frame:globalThis.requestAnimationFrame};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});let root;
  try{
    const [{AuthProvider},{StoreProvider,useStore},{FeedbackProvider},{api},{default:Billing},{createRoot}]=await Promise.all([
      vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx'),
      vite.ssrLoadModule('/src/services/apiClient.js'),vite.ssrLoadModule('/src/pages/billing/Billing.jsx'),import('react-dom/client'),
    ]);
    let redeemed=false,hydrations=0;
    api.get=async endpoint=>{
      if(endpoint==='/api/auth/me')return {user:{id:'activation-owner',organizationId:'activation-org',appRole:'OWNER',name:'Test owner'}};
      if(endpoint==='/api/bootstrap'){hydrations++;return {organization:{id:'activation-org',plan:'ANNUAL',storeLimit:2,licenseStatus:redeemed?'ACTIVE':'PAYMENT_REQUIRED',expiryDate:redeemed?'2099-01-01':null},stores:[{id:'activation-store',name:'Main',active:true}]};}
      if(endpoint==='/api/settings')return {selectedStoreId:'activation-store',workspaceSettings:{},uiPreferences:{},businessFeatures:{},rolePermissions:{}};
      if(endpoint.startsWith('/api/billing/draft'))return {draft:null};
      if(endpoint==='/api/sync/version')return {revision:'1'};
      return {users:[],sessions:[]};
    };
    api.post=async endpoint=>{
      if(endpoint==='/api/billing/promo/preview')return {promo:{percent:100,due:0}};
      assert.equal(endpoint,'/api/billing/promo/redeem-free');redeemed=true;return {success:true};
    };
    const Workspace=()=>{const store=useStore();return React.createElement('div',{'data-workspace':true},store.organizations[0]?.licenseStatus);};
    const container=document.createElement('div');document.body.append(container);root=createRoot(container);
    await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,
      React.createElement(MemoryRouter,{initialEntries:['/activation']},React.createElement(Routes,null,
        React.createElement(Route,{path:'/activation',element:React.createElement(Billing,{activation:true})}),
        React.createElement(Route,{path:'/',element:React.createElement(Workspace)}))))))));
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,50));});
    const input=container.querySelector('input[placeholder="ZENIX-FREE30"]');assert.ok(input,'activation promo input must render');
    await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'TEST-FREE');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    const button=text=>Array.from(container.querySelectorAll('button')).find(node=>node.textContent.trim()===text);
    await act(async()=>button('Promokodni tekshirish').click());
    await act(async()=>button('Bepul faollashtirish').click());
    assert.ok(redeemed);assert.ok(hydrations>=2,'successful redemption must hydrate the updated license');
    assert.equal(container.querySelector('[data-workspace]')?.textContent,'ACTIVE','activation success must navigate to the hydrated workspace');
    assert.equal(container.querySelector('.activation-shell'),null,'an empty activation shell must not remain');
  }finally{
    if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();
    globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;globalThis.requestAnimationFrame=previous.frame;
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:previous.navigator});
  }
});
