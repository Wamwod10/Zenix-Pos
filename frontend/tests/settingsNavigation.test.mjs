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
