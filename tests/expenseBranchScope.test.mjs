import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {MemoryRouter} from 'react-router-dom';

test('expense employee choices and open forms follow the selected branch',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
  const old={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT,frame:globalThis.requestAnimationFrame};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});let root;
  try{
    const [{AuthProvider},{StoreProvider,useStore},{FeedbackProvider},{default:Expenses},{api},{createRoot}]=await Promise.all([
      vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx'),vite.ssrLoadModule('/src/pages/expenses/Expenses.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
    let store,saved;const submitted=[],deleted=[];let uploads=0;
    api.get=async path=>{
      if(path==='/api/auth/me')return {user:{id:'owner',name:'Owner',organizationId:'org',appRole:'OWNER'}};
      if(path==='/api/bootstrap')return {stores:[{id:'a',name:'A'},{id:'b',name:'B'}],organization:{id:'org',licenseStatus:'ACTIVE',accessMode:'READ_WRITE'},employees:[{id:'alice',name:'Alice',store_id:'a',app_role:'CASHIER'},{id:'bob',name:'Bob',store_id:'b',app_role:'CASHIER'},{id:'owner',name:'Owner',store_id:'a',app_role:'OWNER'}]};
      if(path==='/api/settings')return {selectedStoreId:'a'};
      return {items:[],users:[],sessions:[],revision:1};
    };
    api.upload=async()=>{uploads++;return {file:{id:'11111111-1111-4111-8111-111111111111'}}};api.delete=async path=>deleted.push(path);
    api.patch=async()=>({});api.post=async(path,body)=>{if(path==='/api/expenses'){saved=body;submitted.push(body);return submitted.length===1?{}:{expense:{id:'22222222-2222-4222-8222-222222222222',...body}}}return {}};
    function Probe(){store=useStore();return store.workspaceReady?React.createElement(Expenses):null}
    root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,React.createElement(Probe)))))));
    const click=async text=>act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text).click());
    const field=label=>[...document.querySelectorAll('[role="dialog"] label.pro-field')].find(node=>node.querySelector('span')?.textContent===label);
    await click('Xarajat qo‘shish');
    await act(async()=>field('Xodim').querySelector('button').click());
    const names=[...document.querySelectorAll('[role="option"]')].map(node=>node.textContent);
    assert.ok(names.includes('Alice'));assert.ok(!names.includes('Bob'));assert.ok(!names.includes('Owner'));
    await act(async()=>document.querySelector('[role="option"]').click());
    await act(async()=>store.setSelectedStoreId('b'));
    assert.equal(document.querySelector('[role="dialog"]'),null,'old branch form closes');
    await click('Xarajat qo‘shish');
    await act(async()=>field('Xodim').querySelector('button').click());
    assert.ok([...document.querySelectorAll('[role="option"]')].some(node=>node.textContent==='Bob'));
    assert.ok(![...document.querySelectorAll('[role="option"]')].some(node=>node.textContent==='Alice'));
    await act(async()=>[...document.querySelectorAll('[role="option"]')].find(node=>node.textContent==='Bob').click());
    const enter=async(label,value)=>act(async()=>{const input=field(label).querySelector('input');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))});
    await enter('Xarajat nomi *','Transport');await enter('Summa *','50000');
    await act(async()=>field('To‘lov turi').querySelector('button').click());
    await act(async()=>[...document.querySelectorAll('[role="option"]')].find(node=>node.textContent==='Karta').click());
    const receipt=document.querySelector('input[type="file"]');assert.ok(receipt);
    await act(async()=>{Object.defineProperty(receipt,'files',{configurable:true,value:[new dom.window.File(['fixture'],'receipt.png',{type:'image/png'})]});receipt.dispatchEvent(new dom.window.Event('change',{bubbles:true}))});
    await click('Saqlash');assert.equal(saved.storeId,'b');assert.equal(saved.amount,50000);assert.ok(saved.metadata.dateISO);
    assert.equal(uploads,1);assert.equal(deleted.length,0,'uncertain expense outcome must preserve its receipt');
    await click('Saqlash');assert.equal(submitted.length,2);assert.deepEqual(submitted[1],submitted[0]);assert.equal(uploads,1,'retry reuses the original receipt');assert.equal(deleted.length,0);
  }finally{
    if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;globalThis.requestAnimationFrame=old.frame;
  }
});
