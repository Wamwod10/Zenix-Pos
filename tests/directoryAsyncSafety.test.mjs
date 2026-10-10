import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const pause = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 220)); });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const owner = { id:"owner-a", organizationId:"org-1", appRole:"OWNER", name:"Owner A" };
const customer = (id, name = id) => ({ id, name, customerType:"REGULAR", balance:0, overdue:0, totalPurchases:0, saleCount:0 });

async function withSession(page, get, run, user = owner, requests = []) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url:"http://localhost", pretendToBeVisual:true });
  const previous = { window:globalThis.window, document:globalThis.document, navigator:globalThis.navigator, act:globalThis.IS_REACT_ACT_ENVIRONMENT, frame:globalThis.requestAnimationFrame };
  globalThis.window=dom.window; globalThis.document=dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
  Object.defineProperty(globalThis,"navigator",{ configurable:true,value:dom.window.navigator });
  const vite=await createServer({ server:{ middlewareMode:true },appType:"custom",logLevel:"silent" });
  let root;
  try {
    const [{AuthProvider,useAuth},{StoreProvider,useStore},{FeedbackProvider},{api},component] = await Promise.all([
      vite.ssrLoadModule("/src/context/AuthContext.jsx"),vite.ssrLoadModule("/src/context/StoreContext.jsx"),
      vite.ssrLoadModule("/src/context/FeedbackContext.jsx"),vite.ssrLoadModule("/src/services/apiClient.js"),
      page?vite.ssrLoadModule(page):Promise.resolve(null),
    ]);
    api.get=async path=>{
      requests.push(path);
      if(path==="/api/auth/me")return {user};
      if(path==="/api/users/me/sessions")return {sessions:[]};
      if(path==="/api/users")return {users:[]};
      if(path==="/api/bootstrap")return {stores:[{id:"store-1",name:"Main",active:true}],organization:{id:user.organizationId,plan:"MONTHLY",storeLimit:2}};
      if(path==="/api/settings")return {selectedStoreId:"store-1",workspaceSettings:{},uiPreferences:{},businessFeatures:{},rolePermissions:{}};
      if(path==="/api/platform/overview")return {overview:{organizations:2}};
      if(path==="/api/sync/version")return {revision:"1"};
      return get(path);
    };
    api.patch=async()=>({success:true});
    let store,auth;
    const Probe=()=>{store=useStore();auth=useAuth();return null;};
    const {createRoot}=await import("react-dom/client");
    const container=document.createElement("div"); document.body.append(container); root=createRoot(container);
    await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,
      React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,
        React.createElement(Probe),component&&React.createElement(component.default)))))));
    await pause();
    await run({container,dom,api,store:()=>store,auth:()=>auth});
  } finally {
    if(root)await act(async()=>root.unmount());
    await vite.close(); dom.window.close();
    globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;globalThis.requestAnimationFrame=previous.frame;
    Object.defineProperty(globalThis,"navigator",{configurable:true,value:previous.navigator});
  }
}

const button=(container,text)=>Array.from(container.querySelectorAll("button")).find(node=>node.textContent.trim()===text);
async function select(container,label,option) {
  assert.ok(container.querySelector(`[aria-label="${label}"]`),`missing accessible ${label} control`);
  await act(async()=>container.querySelector(`[aria-label="${label}"]`).click());
  const choice=Array.from(document.querySelectorAll('[role="option"]')).find(node=>node.textContent.trim()===option);
  assert.ok(choice,`missing actual ${option} option`);
  await act(async()=>choice.click());
  await pause();
}

async function inputValue(input,value,dom) {
  await act(async()=>{
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,"value").set.call(input,value);
    input.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
  });
}

for(const [label,option] of [["Mijozlar filtri","Barcha mijozlar"],["Mijozlarni saralash","Ism bo‘yicha"],["Saralash yo‘nalishi","O‘sish"]]) {
  test(`reselecting ${label} preserves page one and resets a later page`,async()=>{
    const calls=[];
    await withSession("/src/pages/customers/Customers.jsx",path=>{
      if(path==="/api/customers/stats")return {};
      const params=Object.fromEntries(new URL(path,"http://localhost").searchParams);calls.push(params);
      return {items:[customer(`page-${params.offset}`)],total:125,limit:60,offset:Number(params.offset)};
    },async({container})=>{
      const initialCalls=calls.length;
      await select(container,label,option);
      assert.equal(container.querySelector(".customer-main strong")?.textContent,"page-0","unchanged selection must retain rows");
      assert.equal(button(container,"Keyingi").disabled,false,"unchanged selection must not strand loading");
      assert.equal(calls.length,initialCalls,"page-one no-op must not fetch or invalidate");
      await act(async()=>button(container,"Keyingi").click());await pause();
      assert.equal(calls.at(-1).offset,"60");
      await select(container,label,option);
      assert.equal(calls.at(-1).offset,"0");
      assert.equal(container.querySelector(".customer-main strong")?.textContent,"page-0");
    });
  });
}

for(const mutation of ["create","edit","payment"]) {
  test(`pending customer ${mutation} refreshes the current VIP query after controls change`,async()=>{
    const pending=deferred(),calls=[],writes=[];
    const detail={customer:{...customer("c-1","Existing Customer"),balance:100,creditLimit:200,phone:"",email:"",address:""},ledger:[],sales:[],openCredits:[]};
    await withSession("/src/pages/customers/Customers.jsx",path=>{
      if(path==="/api/customers/stats")return {};
      if(path.startsWith("/api/customers/c-1?"))return detail;
      assert.ok(path.startsWith("/api/customers?"),`unexpected GET ${path}`);
      const params=Object.fromEntries(new URL(path,"http://localhost").searchParams);calls.push(params);
      return {items:[customer("c-1",params.filter==="vip"?"Current VIP":"All Customer")],total:1,limit:60,offset:0};
    },async({container,dom,api})=>{
      const write=async(path,payload)=>{writes.push({path,payload});return pending.promise;};
      if(mutation==="edit")api.patch=write;else api.post=write;
      if(mutation==="create") {
        await act(async()=>button(container,"Mijoz qo‘shish").click());
        await inputValue(document.querySelector('[role="dialog"] .customer-form input'),"New Customer",dom);
        await act(async()=>button(document.querySelector('[role="dialog"]'),"Saqlash").click());
      } else {
        await act(async()=>container.querySelector('.customer-card').click());
        if(mutation==="edit") {
          await act(async()=>button(document,"Tahrirlash").click());
          await act(async()=>button(document.querySelector('[role="dialog"]'),"Saqlash").click());
        } else {
          await inputValue(document.querySelector('.customer-payment input'),"10",dom);
          await act(async()=>button(document,"To‘lov qabul qilish").click());
        }
      }
      assert.equal(writes.length,1,`${mutation} must be pending before changing controls`);
      assert.equal(writes[0].path,mutation==="create"?"/api/customers":mutation==="edit"?"/api/customers/c-1":"/api/customers/c-1/payments");
      while(document.querySelector('[role="dialog"]'))await act(async()=>document.querySelector('[aria-label="Yopish"]').click());
      await select(container,"Mijozlar filtri","VIP");
      const beforeResolve=calls.length;
      assert.equal(container.querySelector('.customer-main strong').textContent,"Current VIP");
      await act(async()=>pending.resolve({customer:detail.customer,payment:{id:"payment-1"}}));await pause();
      assert.ok(calls.length>beforeResolve,"successful mutation must refresh the directory");
      assert.ok(calls.slice(beforeResolve).every(params=>params.filter==="vip"&&params.offset==="0"),"mutation must never fetch its obsolete pre-await query");
      assert.equal(container.querySelector('.customer-main strong')?.textContent,"Current VIP");
    });
  });
}

test("customer directory reaches records past 60, keeps server order and bounds final/empty ranges",async()=>{
  const calls=[];let empty=false;
  await withSession("/src/pages/customers/Customers.jsx",path=>{
    if(path==="/api/customers/stats")return {customers:125};
    const params=new URL(path,"http://localhost").searchParams;calls.push(Object.fromEntries(params));
    const offset=Number(params.get("offset")||0);
    const items=empty?[]:offset===120?[customer("last-5","Zed"),customer("last-4","Alpha"),customer("last-3"),customer("last-2"),customer("last-1")]:Array.from({length:60},(_,i)=>customer(`row-${offset+i}`));
    return {items,total:125,limit:60,offset};
  },async({container})=>{
    assert.deepEqual(calls[0],{q:"",filter:"all",sort:"name",direction:"asc",limit:"60",offset:"0"});
    assert.match(container.querySelector(".customer-pagination").textContent,/1–60.*125/);
    assert.equal(button(container,"Oldingi").disabled,true);
    await select(container,"Mijozlar filtri","Barcha mijozlar");
    assert.equal(container.querySelectorAll(".customer-card").length,60,"reselecting an unchanged filter must not strand the page in loading");
    await act(async()=>button(container,"Keyingi").click());await pause();
    assert.equal(calls.at(-1).offset,"60");
    await act(async()=>button(container,"Keyingi").click());await pause();
    assert.match(container.querySelector(".customer-pagination").textContent,/121–125.*125/);
    assert.deepEqual(Array.from(container.querySelectorAll(".customer-main strong")).slice(0,2).map(node=>node.textContent),["Zed","Alpha"]);
    assert.equal(button(container,"Keyingi").disabled,true);
    empty=true;await select(container,"Mijozlar filtri","VIP");
    assert.match(container.querySelector(".customer-pagination").textContent,/0–0.*125/);
    assert.equal(button(container,"Keyingi").disabled,true);
  });
});

test("customer controls reset offset, send global filters/sorts and debounce bounded search",async()=>{
  const calls=[];
  await withSession("/src/pages/customers/Customers.jsx",path=>{
    if(path==="/api/customers/stats")return {};
    calls.push(Object.fromEntries(new URL(path,"http://localhost").searchParams));
    return {items:[customer("server-match")],total:125,limit:60,offset:Number(calls.at(-1).offset)};
  },async({container,dom})=>{
    for(const [label,option,key,value] of [["Mijozlar filtri","Qarzdorlar","filter","debtors"],["Mijozlarni saralash","Eng ko‘p xarid","sort","spend"],["Saralash yo‘nalishi","Kamayish","direction","desc"]]) {
      assert.ok(button(container,"Keyingi"),"customer directory needs pagination controls");
      await act(async()=>button(container,"Keyingi").click());await pause();
      await select(container,label,option);
      assert.equal(calls.at(-1).offset,"0");assert.equal(calls.at(-1)[key],value);
      assert.equal(container.querySelector(".customer-main strong").textContent,"server-match","server-selected row must not be filtered again");
    }
    await act(async()=>button(container,"Keyingi").click());await pause();
    const input=container.querySelector(".pro-search input");assert.equal(input.maxLength,100);
    const before=calls.length;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,"value").set.call(input,"needle");
      input.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
      input.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
    });
    assert.equal(calls.length,before);await pause();
    assert.equal(calls.at(-1).q,"needle");assert.equal(calls.at(-1).offset,"0");
    await act(async()=>{
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,"value").set.call(input,"x".repeat(150));
      input.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
    });await pause();
    assert.equal(calls.at(-1).q,"x".repeat(100));
  });
});

test("late customer response cannot replace a newer filtered page or loading state",async()=>{
  const stale=deferred();let requests=0;
  await withSession("/src/pages/customers/Customers.jsx",path=>{
    if(path==="/api/customers/stats")return {};
    requests+=1;return requests===1?stale.promise:{items:[customer("new","Current")],total:1,limit:60,offset:0};
  },async({container})=>{
    await select(container,"Mijozlar filtri","VIP");
    assert.equal(container.querySelector(".customer-main strong").textContent,"Current");
    await act(async()=>stale.resolve({items:[customer("old","Stale")],total:900,limit:60,offset:0}));
    assert.equal(container.querySelector(".customer-main strong").textContent,"Current");
    assert.match(container.querySelector(".customer-pagination").textContent,/1–1.*1/);
  });
});

test("reversed organization usage responses keep B visible and closing invalidates pending usage",async()=>{
  const usageA=deferred(),usageB=deferred(),closedUsage=deferred(),reopenedUsage=deferred();let aRequests=0;
  await withSession("/src/pages/platformAdmin/PlatformAdmin.jsx",path=>{
    if(path.startsWith("/api/platform/payments/page"))return {items:[],total:0};
    if(path.startsWith("/api/platform/organizations/page"))return {items:[{id:"org-a",name:"A"},{id:"org-b",name:"B"}],total:2};
    if(path.endsWith("/usage"))return path.includes("org-a")?[usageA,closedUsage,reopenedUsage][aRequests++].promise:usageB.promise;
    if(path.endsWith("/detail"))return {organization:{id:path.includes("org-a")?"org-a":"org-b",name:path.includes("org-a")?"A":"B"}};
    if(path.startsWith("/api/platform/audit-logs"))return {logs:[]};
    throw new Error(`Unexpected ${path}`);
  },async({container})=>{
    await act(async()=>button(container,"Mijozlar").click());await pause();
    const rows=container.querySelectorAll("tbody .pro-icon-btn");
    await act(async()=>rows[0].click());await act(async()=>rows[1].click());
    await act(async()=>usageB.resolve({usage:{receiptBytes:2097152,estimatedBytes:3145728}}));
    assert.match(document.body.textContent,/2 MB/);
    await act(async()=>usageA.resolve({usage:{receiptBytes:9437184,estimatedBytes:9437184}}));
    assert.match(document.body.textContent,/2 MB/);assert.doesNotMatch(document.body.textContent,/9 MB/);
    await act(async()=>document.querySelector('[aria-label="Yopish"]').click());
    assert.equal(document.querySelector('[role="dialog"]'),null);
    await act(async()=>rows[0].click());
    await act(async()=>document.querySelector('[aria-label="Yopish"]').click());
    await act(async()=>rows[0].click());
    await act(async()=>reopenedUsage.resolve({usage:{receiptBytes:4194304,estimatedBytes:4194304}}));
    await act(async()=>closedUsage.resolve({usage:{receiptBytes:8388608,estimatedBytes:8388608}}));
    assert.match(document.querySelector('[role="dialog"]').textContent,/4 MB/);
    assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent,/8 MB/);
  },{id:"platform-1",appRole:"PLATFORM_ADMIN",name:"Admin"});
});

test("late reset token cannot appear in another user's reset workflow",async()=>{
  const pending=deferred();
  await withSession("/src/pages/platformAdmin/PlatformAdmin.jsx",path=>{
    if(path.includes('/page'))return {items:[{id:'org-a',name:'A'}],total:1};
    if(path.endsWith('/detail'))return {organization:{id:'org-a',name:'A',users:[{id:'user-a',name:'Alice'},{id:'user-b',name:'Bob'}]}};
    if(path.endsWith('/usage'))return {usage:{receiptBytes:0}};
    if(path.includes('/audit-logs'))return {logs:[]};
    return {};
  },async({container,dom,api})=>{
    api.post=()=>pending.promise;
    await act(async()=>button(container,'Mijozlar').click());await pause();
    await act(async()=>container.querySelector('tbody .pro-icon-btn').click());await pause();
    const users=()=>Array.from(document.querySelectorAll('.platform-detail-list button')).filter(node=>node.textContent==='Parolni tiklash');
    await act(async()=>users()[0].click());
    await inputValue(Array.from(document.querySelectorAll('input')).find(node=>node.previousElementSibling?.textContent.includes('Sabab')),'Identity checked by support',dom);
    await act(async()=>button(document,'Bir martalik token yaratish').click());
    await act(async()=>button(document,'Token yaratish').click());
    const resetDialog=Array.from(document.querySelectorAll('[role="dialog"]')).find(node=>node.textContent.includes('Bir martalik token yaratish')||node.textContent.includes('Yaratilmoqda...'));
    await act(async()=>resetDialog.querySelector('[aria-label="Yopish"]').click());
    await act(async()=>users()[1].click());
    await act(async()=>pending.resolve({reset:{token:'SECRET-FOR-ALICE',expiresAt:'2099-01-01'}}));
    assert.equal(Boolean(document.querySelector('[aria-label="Tiklash tokeni"]')),false);
  },{id:'platform-1',appRole:'PLATFORM_ADMIN',name:'Admin'});
});

test("owner enumerates staff but manager and cashier never call forbidden users API",async()=>{
 for(const appRole of ['OWNER','MANAGER','CASHIER']){
  const calls=[];
  await withSession(null,()=>({}),async()=>{}, {...owner,appRole},calls);
  assert.equal(calls.includes('/api/users'),appRole==='OWNER');
 }
});

test("same-role user switching writes and resets only the current complete theme key",async()=>{
  await withSession(null,()=>({}),async({api,store,auth,dom})=>{
    await act(async()=>store().setUiPreferences({theme:"dark"}));
    assert.equal(dom.window.localStorage.getItem("zenix:theme:v1:owner-a"),"dark");
    api.post=async()=>({user:{...owner,id:"owner-b",name:"Owner B"}});
    await act(async()=>auth().login("b","password"));await pause();
    await act(async()=>store().setUiPreferences({theme:"light"}));
    assert.equal(dom.window.localStorage.getItem("zenix:theme:v1:owner-a"),"dark");
    assert.equal(dom.window.localStorage.getItem("zenix:theme:v1:owner-b"),"light");
    await act(async()=>store().resetUiPreferences());
    assert.equal(dom.window.localStorage.getItem("zenix:theme:v1:owner-a"),"dark");
    assert.equal(dom.window.localStorage.getItem("zenix:theme:v1:owner-b"),null);
  });
});
