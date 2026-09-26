import test from "node:test";
import assert from "node:assert/strict";
import { createXlsxBytes } from "../src/utils/simpleXlsx.js";
import { invoiceBalance, supplierOpenDebt } from "../src/utils/supplierLedger.js";

test("XLSX export creates a real OpenXML ZIP container without external dependencies", () => {
  const bytes = createXlsxBytes("Mahsulotlar", ["Nomi", "Narx"], [["Coca-Cola", 12000]]);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /xl\/worksheets\/sheet1\.xml/);
  assert.match(text, /Coca-Cola/);
  assert.match(text, /12000/);
});

test("supplier debt export uses invoice ledger instead of a stale legacy field", () => {
  const supplier = {
    debt: 100,
    purchaseHistory: [
      { total: 500000, paidAmount: 200000, paymentStatus: "partial" },
      { total: 100000, paidAmount: 0, paymentStatus: "credit" },
    ],
  };
  assert.equal(invoiceBalance(supplier.purchaseHistory[0]), 300000);
  assert.equal(supplierOpenDebt(supplier), 400000);
});
