import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const polling = await import("../src/pages/billing/billingPolling.js");

test("billing polling is enabled only for this organization's REVIEW payment", () => {
  const rows = [
    { organizationId: "org-1", status: "APPROVED" },
    { organizationId: "org-2", status: "REVIEW" },
  ];
  assert.equal(polling.hasPendingBillingPayment(rows, "org-1"), false);
  assert.equal(polling.hasPendingBillingPayment([...rows, { organizationId: "org-1", status: "REVIEW" }], "org-1"), true);
});

test("billing polling reloads every eight seconds and cleans up", async () => {
  const events = [];
  let tick;
  const scheduler = {
    setInterval(callback, delay) { tick = callback; events.push(["start", delay]); return 42; },
    clearInterval(id) { events.push(["stop", id]); },
  };
  const stop = polling.startBillingPaymentPolling(async () => { events.push(["reload"]); }, scheduler);
  await tick();
  stop();
  assert.deepEqual(events, [["start", 8000], ["reload"], ["stop", 42]]);
});

test("waiting billing polling uses one fast timer and never overlaps reloads", async () => {
  const events = [];
  const ticks = [];
  const scheduler = {
    setInterval(callback, delay) { ticks.push(callback); events.push(["start", delay]); return 7; },
    clearInterval(id) { events.push(["stop", id]); },
  };
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let reloads = 0;
  const stop = polling.startBillingPaymentPolling(async () => { reloads += 1; await pending; }, { intervalMs: 2000, scheduler });
  ticks[0]();
  ticks[0]();
  assert.equal(reloads, 1);
  release();
  await pending;
  await new Promise((resolve) => setImmediate(resolve));
  ticks[0]();
  assert.equal(reloads, 2);
  stop();
  assert.deepEqual(events, [["start", 2000], ["stop", 7]]);
});

test("latest license payment drives waiting, approval and rejection independently of an active license", () => {
  const base = { organizationId: "org-1", type: "LICENSE", submittedAt: "2026-09-26T10:00:00Z" };
  assert.equal(polling.billingPaymentReviewState([{ ...base, status: "REVIEW" }], "org-1"), "waiting");
  assert.equal(polling.billingPaymentReviewState([{ ...base, status: "APPROVED" }], "org-1"), "approved");
  assert.equal(polling.billingPaymentReviewState([{ ...base, status: "REJECTED" }], "org-1"), "rejected");
});

test("Billing uses server reload and never writes an approved status locally", () => {
  const source = fs.readFileSync(new URL("../src/pages/billing/Billing.jsx", import.meta.url), "utf8");
  assert.match(source, /startBillingPaymentPolling\(reloadStore,/);
  assert.doesNotMatch(source, /localStorage[^\n]*(APPROVED|payment)/i);
  assert.doesNotMatch(source, /setPayments[^\n]*APPROVED/);
  assert.doesNotMatch(source, /window\.setInterval/);
});
