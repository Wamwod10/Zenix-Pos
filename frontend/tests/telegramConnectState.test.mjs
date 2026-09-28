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

test("preserves the Telegram settings tab in the platform return URL", async()=>{
  const { telegramReturnUrl }=await import("../src/pages/settings/telegramConnectState.js");

  assert.equal(
    telegramReturnUrl("https://zenix-pos.vercel.app/settings?scope=store#notifications"),
    "https://zenix-pos.vercel.app/settings?scope=store&tab=Telegram#notifications",
  );
});

test("Telegram handoff preserves the platform document in a separate window", async()=>{
  const { openTelegramHandoff, sendTelegramHandoff }=await import("../src/pages/settings/telegramConnectState.js");
  const navigations=[];
  const popup={opener:{},closed:false,location:{replace:(url)=>navigations.push(url)}};

  const target=openTelegramHandoff(()=>popup);
  const sent=sendTelegramHandoff(target,"https://t.me/zenixposbot?startgroup=token");

  assert.equal(target,popup);
  assert.equal(popup.opener,null);
  assert.equal(sent,true);
  assert.deepEqual(navigations,["https://t.me/zenixposbot?startgroup=token"]);
  assert.equal(sendTelegramHandoff(null,"https://t.me/zenixposbot?startgroup=token"),false);
});
