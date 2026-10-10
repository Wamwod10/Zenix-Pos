import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('Register trial requires proof, renders OTP and clears it when phone changes; paid stays available',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/register'});
 const old={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');
 const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'}),root=createRoot(document.getElementById('root'));
 try{
  const [{default:Register},{AuthProvider},{api},{MemoryRouter}]=await Promise.all([vite.ssrLoadModule('/src/pages/register/Register.jsx'),vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-router-dom')]);
  api.get=async path=>path.endsWith('/registration-config')?{mode:'required',phoneVerificationRequired:true,serverTime:new Date().toISOString()}:{};
  const requests=[];api.post=async(path,body)=>{requests.push({path,body});if(path.endsWith('/request'))return{challengeId:'challenge',expiresAt:new Date(Date.now()+300000).toISOString(),resendAt:new Date(Date.now()+60000).toISOString()};if(path.endsWith('/verify'))return{registrationToken:'proof',expiresAt:new Date(Date.now()+300000).toISOString()};return{}};
  await act(async()=>{root.render(React.createElement(MemoryRouter,null,React.createElement(AuthProvider,null,React.createElement(Register))));await new Promise(r=>setTimeout(r,10))});
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
  const change=async(input,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));input.dispatchEvent(new dom.window.Event('change',{bubbles:true}))})};
  assert.equal(button('Davom etish').disabled,true);
  await change(document.querySelector('input[type="tel"]'),'+998 90 123 45 67');
  await act(async()=>button('SMS kod yuborish').click());
  assert.equal(requests[0].body.phone,'+998901234567');
  assert.ok(document.querySelector('input[autocomplete="one-time-code"]'));
  await change(document.querySelector('input[aria-label="SMS kod"]'),'123456');
  await act(async()=>button('Kodni tasdiqlash').click());
  assert.match(document.body.textContent,/Telefon tasdiqlandi/);assert.equal(button('Davom etish').disabled,false);
  await change(document.querySelector('input[type="tel"]'),'+998 90 123 45 68');
  assert.equal(button('Davom etish').disabled,true);assert.doesNotMatch(document.body.textContent,/Telefon tasdiqlandi/);
  await act(async()=>document.querySelector('input[value="MONTHLY"]').click());
  assert.equal(button('Davom etish').disabled,false);assert.equal(document.querySelector('.registration-otp'),null);
 }finally{await act(async()=>root.unmount());await vite.close();dom.window.close();Object.assign(globalThis,old)}
});
