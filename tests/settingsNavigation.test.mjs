import test from "node:test";
import assert from "node:assert/strict";
import { settingsSearchForTab, settingsTabFromSearch } from "../src/pages/settings/settingsNavigation.js";

test("Settings restores the Telegram section from the URL", () => {
  assert.equal(settingsTabFromSearch("?tab=Telegram"),"Telegram");
});

test("Settings falls back to Tashkilot for a missing or invalid tab", () => {
  assert.equal(settingsTabFromSearch(""),"Tashkilot");
  assert.equal(settingsTabFromSearch("?tab=Unknown"),"Tashkilot");
});

test("changing Settings sections preserves unrelated query parameters", () => {
  assert.equal(settingsSearchForTab("?source=telegram&tab=Tashkilot","Ish kuni"),"?source=telegram&tab=Ish+kuni");
});

import { SETTINGS_GROUPS, SETTINGS_TAB_NAMES, searchSettingsTabs, filterSettingsHistory } from "../src/pages/settings/settingsNavigation.js";
test("premium navigation includes every existing section exactly once",()=>{
 const all=SETTINGS_GROUPS.flatMap(group=>group.tabs);
 assert.equal(new Set(all).size,all.length);
 assert.deepEqual([...all].sort(),[...SETTINGS_TAB_NAMES].sort());
});
test("search matches punctuation variants, multiple terms and category names",()=>{
 const index=[["To‘lov shtrix-kod","POS"],["Chek printer","Chek"]];
 assert.deepEqual(searchSettingsTabs(index,"to'lov shtrix kod"),["POS"]);
 assert.deepEqual(searchSettingsTabs(index,"printer"),["Chek"]);
 assert.ok(searchSettingsTabs(index,"savdo kassa").includes("Ombor"));
 assert.deepEqual(searchSettingsTabs(index,"zzmissing"),[]);
});
test("history filters settings only without a fixed 40-entry cap",()=>{
 const entries=Array.from({length:65},(_,i)=>({type:"settings",title:"Chek sozlamasi",description:"Filial "+i}));
 entries.push({type:"sale",title:"Chek sozlamasi"});
 assert.equal(filterSettingsHistory(entries).length,65);
 assert.equal(filterSettingsHistory(entries,"filial 64").length,1);
});
