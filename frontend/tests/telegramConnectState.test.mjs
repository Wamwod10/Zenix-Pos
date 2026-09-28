import test from "node:test";
import assert from "node:assert/strict";

test("offers a retry while Telegram confirmation is still pending", async()=>{
  const { telegramConnectActionState }=await import("../src/pages/settings/telegramConnectState.js");

  assert.deepEqual(
    telegramConnectActionState({canWrite:true,busy:false,connecting:true}),
    {disabled:false,label:"Ulash havolasini qayta ochish"},
  );
});

test("disables the connect action only while a link request is running", async()=>{
  const { telegramConnectActionState }=await import("../src/pages/settings/telegramConnectState.js");

  assert.deepEqual(
    telegramConnectActionState({canWrite:true,busy:true,connecting:true}),
    {disabled:true,label:"Havola yaratilmoqda..."},
  );
  assert.deepEqual(
    telegramConnectActionState({canWrite:false,busy:false,connecting:false}),
    {disabled:true,label:"Telegram guruhini ulash"},
  );
});

test("rejects an aborted or superseded Telegram connection attempt before side effects", async()=>{
  const { isCurrentTelegramConnectAttempt }=await import("../src/pages/settings/telegramConnectState.js");
  const active=new AbortController();
  const aborted=new AbortController();
  aborted.abort();

  assert.equal(isCurrentTelegramConnectAttempt({signal:active.signal,attempt:3,currentAttempt:3}),true);
  assert.equal(isCurrentTelegramConnectAttempt({signal:aborted.signal,attempt:3,currentAttempt:3}),false);
  assert.equal(isCurrentTelegramConnectAttempt({signal:active.signal,attempt:2,currentAttempt:3}),false);
});
