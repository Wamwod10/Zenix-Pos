import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("billing checkout draft freezes the selected renewal calculation", async () => {
  const { createCheckoutDraft } = await import("../src/utils/billingCheckout.js");
  const order={
    orderId:"TP-TEST",type:"LICENSE",intent:"RENEW",plan:"ANNUAL",
    currentExpiry:"2027-09-10",servicePeriodFrom:"2027-09-10",servicePeriodTo:"2029-01-21",
    targetExpiry:"2029-01-21",extensionDays:499,baseAmount:4511507,extraStoreAmount:0,
    renewalExtraStores:0,amount:4511507,purpose:"Yillik tarifni 2029-01-21 gacha uzaytirish",
  };
  const draft=createCheckoutDraft({
    source:"renewal",order,currentPlan:"ANNUAL",currentEndDate:"2027-09-10",
    selectedEndDate:"2029-01-21",durationDays:499,additionalBranchCount:0,
    additionalBranchCost:0,totalAmount:4511507,metadata:{usedStores:2,storeLimit:2},
  });
  assert.equal(draft.order.amount,4511507);
  assert.equal(draft.order.servicePeriodTo,"2029-01-21");
  assert.equal(draft.selectedEndDate,"2029-01-21");
  assert.equal(draft.durationDays,499);
  assert.equal(draft.totalAmount,4511507);
  assert.equal(draft.metadata.usedStores,2);
});

test("Billing payment uses the server checkout draft instead of recalculating renewal defaults", () => {
  const billing=read("src/pages/billing/Billing.jsx");
  assert.match(billing,/checkoutDraft/);
  assert.match(billing,/createBillingDraft/);
  assert.match(billing,/selectedEndDate:renewTargetDate/);
  assert.match(billing,/extraStoreCount:renewExtraStores/);
  assert.match(billing,/const checkoutOrder=checkoutDraft\?\.order\|\|order/);
  assert.match(billing,/checkoutOrder\.amount/);
  assert.match(billing,/commitBillingSubmission\(\{draftId:draft\.id,file\}\)/);
  assert.match(billing,/if\(!draft\?\.id\)/);
  assert.doesNotMatch(billing,/const payment=flow==="payment"&&<section[\s\S]*?BILLING_PLANS\[plan\]\.label[\s\S]*?billingPrice\(order\.amount\)/);
});

test("Billing back navigation keeps an open server draft and restores renewal inputs", () => {
  const billing=read("src/pages/billing/Billing.jsx");
  assert.match(billing,/loadBillingDraft\(\)/);
  assert.match(billing,/setRenewTargetDate\(draft\.selectedEndDate\|\|defaultRenewTargetDate\)/);
  assert.match(billing,/setRenewExtraStores\(Math\.max\(0,Number\(draft\.extraStoreCount\|\|0\)\)\)/);
  assert.match(billing,/if\(paymentType==="LICENSE"&&flow==="payment"\)setFlow\(licenseIntent==="RENEW"\?"renew":"plans"\)/);
});
