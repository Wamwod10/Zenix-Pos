import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('cross-tab auth revisions clear old identity and stale responses cannot restore it',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 const old={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'}),root=createRoot(document.getElementById('root'));
 try{
  const [{AuthProvider,useAuth},{api}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/services/apiClient.js')]);
  let current,resolveOld;
  api.get=async path=>path==='/api/auth/me'?{user:{id:'old',appRole:'CASHIER',organizationId:'org'}}:{};
  function Probe(){current=useAuth();return null}
  await act(async()=>{root.render(React.createElement(AuthProvider,null,React.createElement(Probe)));await new Promise(r=>setTimeout(r,20))});assert.equal(current.currentUser.id,'old');
  api.get=path=>path==='/api/auth/me'?new Promise(resolve=>{resolveOld=resolve}):Promise.resolve({});
  await act(async()=>{window.dispatchEvent(new window.StorageEvent('storage',{key:'zenix:auth:revision:v1',newValue:'1'}))});assert.equal(current.currentUser,null);assert.equal(current.authLoading,true);
  api.get=async()=>({user:{id:'new',appRole:'CASHIER',organizationId:'other'}});
  await act(async()=>{window.dispatchEvent(new window.StorageEvent('storage',{key:'zenix:auth:revision:v1',newValue:'2'}));await new Promise(r=>setTimeout(r,20))});assert.equal(current.currentUser.id,'new');
  await act(async()=>{resolveOld({user:{id:'old',appRole:'CASHIER',organizationId:'org'}});await new Promise(r=>setTimeout(r,20))});assert.equal(current.currentUser.id,'new');assert.equal(current.authLoading,false);
 }finally{await act(async()=>root.unmount());await vite.close();dom.window.close();Object.assign(globalThis,old)}
});
