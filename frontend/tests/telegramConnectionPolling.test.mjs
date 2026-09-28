import test from "node:test";
import assert from "node:assert/strict";
import { telegramConnectionForStore, waitForTelegramConnection } from "../src/services/telegramPolling.js";
import { createTelegramReturnRefresh } from "../src/pages/settings/telegramReturnRefresh.js";

test("an aborted Telegram poll stops without loading or changing connection state", async()=>{
  const controller=new AbortController();
  controller.abort();
  let loads=0;

  const result=await waitForTelegramConnection({
    storeId:"store-1",
    signal:controller.signal,
    loadConnections:async()=>{loads+=1;return[]},
  });

  assert.deepEqual(result,{connected:false,aborted:true});
  assert.equal(loads,0);
});

test("returning from Telegram performs one lightweight connection refresh", async()=>{
  let release;
  const pending=new Promise((resolve)=>{release=resolve});
  let loads=0;
  const applied=[];
  const refresh=createTelegramReturnRefresh({
    isVisible:()=>true,
    loadConnection:async()=>{loads+=1;return pending},
    applyConnection:(connection)=>applied.push(connection),
  });

  const focusRefresh=refresh();
  const visibilityRefresh=refresh();
  release({connected:true,connectionId:"connection-1",groupName:"Savdo guruhi"});
  await Promise.all([focusRefresh,visibilityRefresh]);

  assert.equal(loads,1);
  assert.deepEqual(applied,[{connected:true,connectionId:"connection-1",groupName:"Savdo guruhi"}]);
});

test("lightweight refresh maps only the current store connection", ()=>{
  const result=telegramConnectionForStore([
    {id:"other",store_id:"store-2",chat_title:"Boshqa guruh",enabled:true},
    {id:"current",store_id:"store-1",chat_id:-100123,chat_title:"Savdo guruhi",enabled:true},
  ],"store-1");

  assert.deepEqual(result,{connected:true,connectionId:"current",chatId:"-100123",groupName:"Savdo guruhi",connectedAt:null});
});
