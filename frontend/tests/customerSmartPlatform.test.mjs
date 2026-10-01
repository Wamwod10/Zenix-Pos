import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
test("customers expose professional credit aging and payment methods",()=>{const ui=read("src/pages/customers/Customers.jsx");assert.match(ui,/Qarzdorlik aging/);assert.match(ui,/0–7 kun/);assert.match(ui,/60\+ kun/);assert.match(ui,/paymentMethod/);assert.match(ui,/Ochiq nasiyalar/);assert.match(ui,/Loyalty/)});
test("dashboard exposes Zenix Pulse and stock forecast",()=>{const ui=read("src/pages/dashboard/Dashboard.jsx");assert.match(ui,/Zenix Pulse/);assert.match(ui,/stockForecast/);assert.match(ui,/daysLeft/);assert.match(ui,/Hammasi joyida/)});
test("global command includes customers and quick customer action",()=>{const ui=read("src/layout/MainLayout.jsx");assert.match(ui,/customerLookup/);assert.match(ui,/Mijoz qo‘shish/)});
test("customer credit schema supports allocations and loyalty",()=>{const migration=read("../backend/migrations/013_customer_credit_hardening.sql");assert.match(migration,/customer_payment_allocations/);assert.match(migration,/customer_loyalty_ledger/);assert.match(migration,/loyalty_tier/)});
