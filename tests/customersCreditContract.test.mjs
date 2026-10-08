import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const sales=fs.readFileSync(new URL('../src/pages/sales/Sales.jsx',import.meta.url),'utf8');const ctx=fs.readFileSync(new URL('../src/context/StoreContext.jsx',import.meta.url),'utf8');const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
test('customers route exists',()=>assert.match(app,/path="customers"/));
test('credit checkout requires customer and due date',()=>{assert.match(sales,/Nasiya savdo uchun mijoz va to‘lov muddatini tanlang/);assert.match(sales,/creditDueDate/)});test('credit payload carries customer and remainder',()=>{assert.match(ctx,/customerId:sale.customerId/);assert.match(ctx,/creditAmount:number\(sale.creditAmount,0\)/)});
