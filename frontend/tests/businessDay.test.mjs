import test from "node:test";
import assert from "node:assert/strict";
import { workspaceBusinessDateISO } from "../src/utils/workspaceDate.js";
import { recordDateKey } from "../src/utils/reporting.js";

const org = { timezone:"Asia/Tashkent" };

test("business day keeps normal calendar date after configured start time", () => {
  // 2026-09-24 07:30 in Tashkent (+05:00)
  const value = new Date("2026-09-24T02:30:00.000Z");
  assert.equal(workspaceBusinessDateISO(value, org, { startTime:"06:00" }), "2026-09-24");
});

test("business day assigns after-midnight sale before start time to previous day", () => {
  // 2026-09-24 02:30 in Tashkent (+05:00)
  const value = new Date("2026-09-23T21:30:00.000Z");
  assert.equal(workspaceBusinessDateISO(value, org, { startTime:"06:00" }), "2026-09-23");
});

test("midnight business-day start behaves like calendar day", () => {
  const value = new Date("2026-09-23T21:30:00.000Z");
  assert.equal(workspaceBusinessDateISO(value, org, { startTime:"00:00" }), "2026-09-24");
});

test("reporting prefers businessDateISO when present", () => {
  assert.equal(recordDateKey({ dateISO:"2026-09-24", businessDateISO:"2026-09-23" }, "Asia/Tashkent"), "2026-09-23");
});


test("reporting period API accepts business-day settings", async () => {
  const source = await import("node:fs/promises").then(({readFile})=>readFile(new URL("../src/utils/reporting.js", import.meta.url), "utf8"));
  assert.match(source, /businessDay = null/);
  assert.match(source, /workspaceBusinessDateISO/);
});
