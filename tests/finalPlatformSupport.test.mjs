import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('support diagnostics follows server paging for all issue streams',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 const old={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'}),root=createRoot(document.getElementById('root'));
 try{
  const [{BusinessDiagnostics},{api}]=await Promise.all([vite.ssrLoadModule('/src/pages/platformAdmin/PlatformTools.jsx'),vite.ssrLoadModule('/src/services/apiClient.js')]);const requests=[];
  api.get=async path=>{requests.push(path);return {support:{apiIssues:[],billingIssues:[],deliveryIssues:[],hasMore:{billing:false,delivery:!path.endsWith('offset=20'),api:false}}}};
  await act(async()=>root.render(React.createElement(BusinessDiagnostics,{organization:{id:'org'},usage:{}})));
  await act(async()=>{document.querySelector('button').click();await new Promise(r=>setTimeout(r,20))});
  let next=[...document.querySelectorAll('button')].find(el=>el.textContent==='Keyingi');assert.equal(next.disabled,false);
  await act(async()=>{next.click();await new Promise(r=>setTimeout(r,20))});
  assert.deepEqual(requests,['/api/platform/organizations/org/support?limit=20&offset=0','/api/platform/organizations/org/support?limit=20&offset=20']);
  next=[...document.querySelectorAll('button')].find(el=>el.textContent==='Keyingi');assert.equal(next.disabled,true);assert.equal([...document.querySelectorAll('button')].find(el=>el.textContent==='Oldingi').disabled,false);
 }finally{await act(async()=>root.unmount());await vite.close();dom.window.close();Object.assign(globalThis,old)}
});
