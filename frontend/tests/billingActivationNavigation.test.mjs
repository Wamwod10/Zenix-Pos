import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { workspaceAccessState } from "../src/utils/license.js";

test("approved active organization immediately unlocks protected workspace routes", () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(workspaceAccessState({ organization: { licenseStatus: "ACTIVE", expiryDate: future } }).allowed, true);
});

test("pending payment does not keep an already active organization locked", () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(workspaceAccessState({
    organization: { licenseStatus: "ACTIVE", expiryDate: future },
    payments: [{ status: "REVIEW", type: "LICENSE" }],
  }).allowed, true);
});

test("review and payment-required organizations remain blocked", () => {
  assert.equal(workspaceAccessState({ organization: { licenseStatus: "REVIEW" } }).allowed, false);
  assert.equal(workspaceAccessState({ organization: { licenseStatus: "PAYMENT_REQUIRED" } }).allowed, false);
});

test("expired active organization remains blocked", () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  assert.deepEqual(workspaceAccessState({ organization: { licenseStatus: "ACTIVE", expiryDate: past } }).reason, "EXPIRED");
});

test("workspace hydration commits bootstrap entitlement even when settings refresh fails", () => {
  const source = fs.readFileSync(new URL("../src/context/StoreContext.jsx", import.meta.url), "utf8");
  assert.match(source, /Promise\.allSettled\(\[api\.get\("\/api\/bootstrap"\),api\.get\("\/api\/settings"\)\]\)/);
  assert.match(source, /if\(baseResult\.status!=="fulfilled"\)throw baseResult\.reason/);
  assert.match(source, /settingsResult\.status==="fulfilled"\?\(settingsResult\.value\|\|\{\}\):\{\}/);
});
