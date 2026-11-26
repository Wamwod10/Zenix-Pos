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

import { SETTINGS_GROUPS, SETTINGS_TAB_NAMES, searchSettingsTabs, settingsAuditQuery } from "../src/pages/settings/settingsNavigation.js";
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
test("settings history requests scoped server audit pages with safe filters",()=>{
 const params=new URLSearchParams(settingsAuditQuery({query:"  Chek  ",page:3,from:"2026-11-01",to:"2026-11-27"}));
 assert.equal(params.get("type"),"settings");assert.equal(params.get("q"),"Chek");assert.equal(params.get("offset"),"60");assert.equal(params.get("limit"),"20");assert.equal(params.get("from"),"2026-11-01");
 assert.equal(new URLSearchParams(settingsAuditQuery({page:-1,from:"invalid"})).get("offset"),"0");
 assert.equal(new URLSearchParams(settingsAuditQuery({from:"invalid"})).has("from"),false);
});
