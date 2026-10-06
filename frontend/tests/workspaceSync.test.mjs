import test from "node:test";
import assert from "node:assert/strict";

const syncModule=await import("../src/utils/workspaceSync.js").catch(()=>({}));

const deferred=()=>{let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});return {promise,resolve,reject}};
const flush=()=>new Promise((resolve)=>setImmediate(resolve));
const timerHarness=()=>{
  let id=0;const timers=new Map();
  return {
    setTimer(fn,delay){const key=++id;timers.set(key,{fn,delay});return key},
    clearTimer(key){timers.delete(key)},
    async runDelay(delay){const match=[...timers.entries()].find(([,timer])=>timer.delay===delay);assert.ok(match,`missing ${delay}ms timer`);timers.delete(match[0]);await match[1].fn();await flush()},
    delays:()=>[...timers.values()].map((timer)=>timer.delay),
  };
};

test("workspace sync refreshes once only when revision changes",async()=>{
  assert.equal(typeof syncModule.createWorkspaceSyncController,"function","workspace sync controller must be available");
  const versions=[4,4,5];let refreshes=0;
  const controller=syncModule.createWorkspaceSyncController({
    getVersion:async()=>({revision:versions.shift()}),refresh:async()=>{refreshes+=1},getIdentity:()=>"user-a:org-a",isVisible:()=>true,
  });
  await controller.checkNow();assert.equal(refreshes,0);
  await controller.checkNow();assert.equal(refreshes,0);
  await controller.checkNow();assert.equal(refreshes,1);
  controller.stop();
});

test("workspace sync keeps version checks single-flight",async()=>{
  const request=deferred();let starts=0;
  const controller=syncModule.createWorkspaceSyncController({
    getVersion:()=>{starts+=1;return request.promise},refresh:async()=>{},getIdentity:()=>"user-a:org-a",isVisible:()=>true,
  });
  const first=controller.checkNow();const second=controller.checkNow();
  assert.equal(starts,1);
  request.resolve({revision:1});await Promise.all([first,second]);
  controller.stop();
});

test("workspace sync performs one follow-up when a change arrives during refresh",async()=>{
  const refreshGate=deferred();const versions=[4,5,6];let refreshes=0;
  const controller=syncModule.createWorkspaceSyncController({
    getVersion:async()=>({revision:versions.shift()}),
    refresh:async()=>{refreshes+=1;if(refreshes===1)await refreshGate.promise},
    getIdentity:()=>"user-a:org-a",isVisible:()=>true,
  });
  await controller.checkNow();
  const changing=controller.checkNow();await flush();
  const during=controller.checkNow();
  refreshGate.resolve();await Promise.all([changing,during]);await flush();
  assert.equal(refreshes,2);
  controller.stop();
});

test("workspace sync pauses while hidden and checks immediately on visibility or online",async()=>{
  let visible=false,checks=0,visibilityHandler,onlineHandler;
  const timers=timerHarness();
  const controller=syncModule.createWorkspaceSyncController({
    getVersion:async()=>{checks+=1;return {revision:1}},refresh:async()=>{},getIdentity:()=>"user-a:org-a",isVisible:()=>visible,
    addVisibilityListener:(handler)=>{visibilityHandler=handler;return()=>{visibilityHandler=null}},
    addOnlineListener:(handler)=>{onlineHandler=handler;return()=>{onlineHandler=null}},
    setTimer:timers.setTimer,clearTimer:timers.clearTimer,
  });
  controller.start();await flush();assert.equal(checks,0);
  visible=true;visibilityHandler();await flush();assert.equal(checks,1);
  onlineHandler();await flush();assert.equal(checks,2);
  controller.stop();assert.equal(visibilityHandler,null);assert.equal(onlineHandler,null);
});

test("workspace sync discards a late version response after identity changes",async()=>{
  let identity="user-a:org-a",refreshes=0;const request=deferred();
  const controller=syncModule.createWorkspaceSyncController({
    getVersion:()=>request.promise,refresh:async()=>{refreshes+=1},getIdentity:()=>identity,isVisible:()=>true,
  });
  const checking=controller.checkNow();identity="user-b:org-b";request.resolve({revision:9});await checking;
  assert.equal(refreshes,0);controller.stop();
});

test("workspace sync backs off version errors while fallback refresh remains active",async()=>{
  const timers=timerHarness();let refreshes=0;
  const controller=syncModule.createWorkspaceSyncController({
    getVersion:async()=>{throw new Error("offline")},refresh:async()=>{refreshes+=1},getIdentity:()=>"user-a:org-a",isVisible:()=>true,
    setTimer:timers.setTimer,clearTimer:timers.clearTimer,pollMs:1000,fallbackMs:60000,
  });
  controller.start();await flush();await flush();
  assert.ok(timers.delays().includes(2000));
  await timers.runDelay(60000);assert.equal(refreshes,1);
  controller.stop();
});
