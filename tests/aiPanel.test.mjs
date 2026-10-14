import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {MemoryRouter,Routes,Route,Link} from 'react-router-dom';

test('shared AI panel preserves conversation across navigation and requires explicit action confirmation',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT,raf:globalThis.requestAnimationFrame};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
 const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});let root;
 try{
  const [{AuthProvider,useAuth},{StoreProvider,useStore},{FeedbackProvider},{default:MainLayout},{api},{createRoot}]=await Promise.all([
   vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx'),vite.ssrLoadModule('/src/layout/MainLayout.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const status={limit:100,remaining:99,enabled:true,writable:true,writesEnabled:true,planCode:'BUSINESS',suggestions:[]};
  const preview={productName:'Olma',warehouseName:'Asosiy ombor',storeName:'Main',quantity:5,unit:'kg',costPrice:10000};
  let actionStatus='PENDING',confirmRelease,confirmFail=false,chatRelease,delayChat=false,actionGetFail=false,sessionId='session-one',expiryOffset=60000,report=null,loginRole='OWNER',permissionOverrides,settingsRolePermissions={};
  const posts=[];
  api.get=async path=>{
   if(path==='/api/auth/me')return {user:{id:'owner',organizationId:'org',appRole:'OWNER'}};
   if(path==='/api/bootstrap')return {stores:[{id:a,name:'Main'},{id:b,name:'Other'}],inventory:[],organization:{id:'org',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:2}};
   if(path==='/api/settings')return {selectedStoreId:a,rolePermissions:settingsRolePermissions};
   if(path==='/api/ai/status')return status;
   if(path==='/api/users/me/sessions')return {sessions:[{id:sessionId,current:true}]};
   if(path.startsWith('/api/ai/actions/')){assert.equal(path,'/api/ai/actions/action-1/status');if(actionGetFail)throw Error('offline');return {id:'action-1',status:actionStatus};}
   return {users:[],sessions:[],revision:'1'};
  };
  api.patch=async()=>({});
  api.post=async(path,body)=>{
   posts.push({path,body});
   if(path==='/api/ai/chat'){
    const response={conversationId:'33333333-3333-4333-8333-333333333333',answer:'Kirimni tekshiring',report,insights:[],actions:[{id:'action-1',type:'stock_receipt',status:'PENDING',expiresAt:new Date(Date.now()+expiryOffset).toISOString(),confirmationToken:'secret-token',preview}]};
    if(delayChat)return new Promise(resolve=>chatRelease=()=>resolve(response));return response;
   }
   if(path.endsWith('/confirm')){if(confirmFail)throw Error('network lost');return new Promise(resolve=>confirmRelease=()=>{actionStatus='CONFIRMED';resolve({id:'action-1',status:'CONFIRMED',result:{receiptId:'receipt-1',before:0,after:5,delta:5,unit:'kg'}})});}
   if(path.endsWith('/cancel')){actionStatus='CANCELLED';return {id:'action-1',status:'CANCELLED'};}
   if(path==='/api/auth/login')return {user:{id:body.username,organizationId:'org',appRole:loginRole,permissionOverrides}};
   return {};
  };
  let store,auth;function Probe(){store=useStore();auth=useAuth();return null;}
  const page=React.createElement('div',null,React.createElement(Link,{to:'/inventory'},'Go inventory'));
  root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,React.createElement(Probe),React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(MainLayout)},React.createElement(Route,{path:'/',element:page}),React.createElement(Route,{path:'/inventory',element:page})))))))));
  const container=document.getElementById('root');
  const button=text=>Array.from(container.querySelectorAll('button')).find(node=>node.textContent.trim()===text);
  const type=async text=>act(async()=>{const input=container.querySelector('#zenix-ai-question');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,text);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  const submit=async text=>{await type(text);await act(async()=>container.querySelector('.zenix-ai-compose').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
  assert.equal(container.querySelectorAll('.menu a[href="/ai"]').length,0,'AI is absent from sidebar');
  await act(async()=>button('ZENIX AI').click());
  assert.equal(container.querySelectorAll('[aria-label="ZENIX AI yordamchi"]').length,1);
  await submit('Omborga 5 kg olma kirim qil');
  assert.match(container.querySelector('.zenix-ai-action').textContent,/Olma.*Main.*Asosiy ombor.*5.*kg.*10000/s);
  assert.equal(posts.filter(p=>p.path.endsWith('/confirm')).length,0);
  assert.equal(posts[0].body.conversationId,null);
  await submit('tasdiqlayman');
  assert.equal(posts.filter(p=>p.path.endsWith('/confirm')).length,0,'chat text never executes actions');
  assert.equal(posts[1].body.conversationId,'33333333-3333-4333-8333-333333333333');
  assert.equal('messages' in posts[1].body,false);
  await act(async()=>container.querySelector('a[href="/inventory"]').click());
  assert.match(container.querySelector('.zenix-ai-messages').textContent,/Omborga 5 kg/);
  await act(async()=>container.querySelector('[aria-label="AI panelini yopish"]').click());
  await act(async()=>container.querySelector('[aria-label="ZENIX AI ochish"]').click());
  assert.equal(container.querySelectorAll('[aria-label="ZENIX AI yordamchi"]').length,1);
  await act(async()=>button('Tasdiqlash').click());
  assert.equal(posts.at(-1).path,'/api/ai/actions/action-1/confirm');
  assert.deepEqual(posts.at(-1).body,{confirmationToken:'secret-token'});
  assert.ok(button('Tasdiqlash')?.disabled!==false,'double confirmation is disabled');
  await act(async()=>confirmRelease());
  assert.match(container.querySelector('.zenix-ai-action').textContent,/Bajarildi/);
  await act(async()=>store.setSelectedStoreId(b));
  assert.equal(container.querySelectorAll('.zenix-ai-answer').length,0,'branch change clears old context');
  await submit('Yangi kirim');
  assert.equal(posts.at(-1).body.conversationId,null);
  assert.equal(posts.at(-1).body.storeId,b);
  await act(async()=>button('Bekor qilish').click());
  assert.match(container.querySelector('.zenix-ai-action').textContent,/Bekor qilindi/);
  await act(async()=>auth.login('other-user','test'));
  assert.equal(container.querySelectorAll('.zenix-ai-answer').length,0,'user change clears old context');
  await submit('Yana kirim');
  confirmFail=true;actionGetFail=true;
  await act(async()=>button('Tasdiqlash').click());
  assert.match(container.querySelector('.zenix-ai-action').textContent,/Holatni tekshirish/);
  assert.ok(!button('Tasdiqlash')||button('Tasdiqlash').disabled,'uncertain result cannot be resubmitted');
  assert.ok(button('Yangi suhbat')?.disabled,'unresolved financial action cannot be erased by manual reset');
  await submit('Kirim holati qanday?');
  assert.ok(Array.from(container.querySelectorAll('.zenix-ai-action button')).filter(node=>node.textContent==='Tasdiqlash').every(node=>node.disabled),'repeated pending preview cannot unlock an uncertain action');
  actionGetFail=false;actionStatus='CONFIRMED';
  await act(async()=>button('Holatni tekshirish').click());
  assert.match(container.querySelector('.zenix-ai-action').textContent,/Bajarildi/);
  await act(async()=>store.setSelectedStoreId(a));
  delayChat=true;await submit('Kech javob');
  await act(async()=>store.setSelectedStoreId(b));
  await act(async()=>chatRelease());
  assert.equal(container.querySelectorAll('.zenix-ai-answer').length,0,'late chat cannot enter the next branch');
  delayChat=false;await submit('Sessiya suhbat');sessionId='session-two';
  await act(async()=>auth.refreshSessions());
  assert.equal(container.querySelectorAll('.zenix-ai-answer').length,0,'new session clears conversation for the same user');
  expiryOffset=-1000;await submit('Muddati tugagan kirim');
  assert.match(container.querySelector('.zenix-ai-action').textContent,/muddati tugadi/);
  assert.equal(button('Tasdiqlash'),undefined);
  await act(async()=>store.setSelectedStoreId(a));
  expiryOffset=60000;status.writesEnabled=false;await submit('Yozish o‘chirilgan');
  assert.equal(button('Tasdiqlash').disabled,true);
  await act(async()=>store.setSelectedStoreId(b));
  status.writesEnabled=true;report={from:'2026-10-01',to:'2026-10-15',facts:[{id:'sales',label:'Savdo',value:'123456.78',unit:'UZS'}],tables:[],notes:['Hisobot izohi']};
  await submit('Eski hisobot');
  assert.match(container.querySelector('.zenix-ai-answer').textContent,/123456.78/);
  actionStatus='STALE';await act(async()=>button('Tasdiqlash').click());
  assert.match(container.querySelector('.zenix-ai-action').textContent,/Yangi kirim taklifini/);
  assert.equal(button('Tasdiqlash'),undefined);
  assert.ok(button('Yangi suhbat'));
  await act(async()=>button('Yangi suhbat').click());
  assert.equal(container.querySelectorAll('.zenix-ai-answer').length,0);
  await submit('Yangi suhbat savoli');
  assert.equal(posts.at(-1).body.conversationId,null,'manual new chat discards old server context');
  loginRole='MANAGER';
  for(const module of ['moduleProducts','moduleInventory']){
   permissionOverrides={moduleDashboard:false,moduleHistory:false,moduleAnalytics:false,moduleSellerAnalytics:false,moduleExpenses:false,moduleSuppliers:false,moduleProducts:false,moduleInventory:false,[module]:true};
   await act(async()=>auth.login(module,'test'));
   assert.ok(button('ZENIX AI'),`${module}-only staff can open AI for allowed data`);
  }
  permissionOverrides=undefined;await act(async()=>auth.login('role-map-user','test'));
  await submit('Maxfiy savdo hisoboti');
  assert.match(container.querySelector('.zenix-ai-answer').textContent,/123456.78/);
  const unchangedBranch=store.currentStoreId;
  settingsRolePermissions={MANAGER:{moduleAnalytics:false,moduleHistory:false,moduleInventory:true}};
  await act(async()=>store.reloadStore({silent:true}));
  assert.equal(auth.currentUser.id,'role-map-user');assert.equal(auth.currentUser.appRole,'MANAGER');assert.equal(store.currentStoreId,unchangedBranch);
  assert.ok(button('ZENIX AI'),'inventory access remains after report permissions change');
  assert.equal(container.querySelectorAll('.zenix-ai-answer').length,0,'hydrated role permission change erases old confidential reports');
  await submit('Yangilangan ruxsatlar');assert.equal(posts.at(-1).body.conversationId,null);
 }finally{
  if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;globalThis.requestAnimationFrame=old.raf;
 }
});
