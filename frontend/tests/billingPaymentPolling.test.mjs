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

test("Billing uses server reload and never writes an approved status locally", () => {
  const source = fs.readFileSync(new URL("../src/pages/billing/Billing.jsx", import.meta.url), "utf8");
  assert.match(source, /startBillingPaymentPolling\(reloadStore\)/);
  assert.doesNotMatch(source, /localStorage[^\n]*(APPROVED|payment)/i);
  assert.doesNotMatch(source, /setPayments[^\n]*APPROVED/);
});
