import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('platform theme survives reload and synchronizes manual choices across tabs',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
  const old={window:globalThis.window,document:globalThis.document};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
  const root=createRoot(document.getElementById('root'));
  try{
    const [{AuthProvider},{StoreProvider,useStore},{api}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/services/apiClient.js')]);
    window.localStorage.setItem('zenix:theme:v1:admin','dark');
    api.get=async path=>path==='/api/auth/me'?{user:{id:'admin',appRole:'PLATFORM_ADMIN'}}:{overview:{}};
    let store;
    function Probe(){store=useStore();return React.createElement('span',null,store.uiPreferences.theme)}
    await act(async()=>{root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(Probe))));await new Promise(r=>setTimeout(r,30))});
    assert.equal(store.uiPreferences.theme,'dark');
    await act(async()=>{window.localStorage.setItem('zenix:theme:v1:admin','light');window.dispatchEvent(new window.StorageEvent('storage',{key:'zenix:theme:v1:admin',newValue:'light'}))});
    assert.equal(store.uiPreferences.theme,'light');
    await act(async()=>{await store.reloadStore()});
    assert.equal(store.uiPreferences.theme,'light');
  }finally{await act(async()=>root.unmount());await vite.close();dom.window.close();Object.assign(globalThis,old)}
});
