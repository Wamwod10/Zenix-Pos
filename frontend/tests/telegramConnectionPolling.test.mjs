import test from "node:test";
import assert from "node:assert/strict";
import { waitForTelegramConnection } from "../src/services/telegramPolling.js";

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
