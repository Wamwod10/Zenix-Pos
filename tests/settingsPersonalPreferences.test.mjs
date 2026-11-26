import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("personal appearance has independent confirmed save status and is not an organization write",()=>{
 const store=read("src/context/StoreContext.jsx"),ui=read("src/pages/settings/Settings.jsx");
 assert.match(store,/await api\.patch\("\/api\/settings\/preferences",\{uiPreferences:next\}\)/);
 assert.match(store,/uiPreferencePendingRef\.current!==pending/);
 assert.match(store,/readPreferenceRevision===uiPreferenceSequenceRef\.current/);
 assert.match(store,/setUiPreferenceSave\(\{identity,state:"saved",error:""\}\)/);
 assert.match(ui,/const changeUi=patch=>setUiPreferences\(patch\)/);
 const section=ui.split('{tab==="Interfeys"&&')[1].split("\n")[0];
 assert.doesNotMatch(section,/disabled=\{!canWrite\}/);
 assert.match(section,/retryUiPreferences/);
});
