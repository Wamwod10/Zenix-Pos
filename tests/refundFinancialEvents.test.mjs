import test from 'node:test';import assert from 'node:assert/strict';
import * as reporting from '../src/utils/reporting.js';
const sale={id:'sale',storeId:'a',dateISO:'2026-10-08',total:100,returnedTotal:25,paymentMethod:'card',items:[{productId:'p',quantity:4,finalPrice:25,costPrice:10,returnedQty:1}]};
const ret={id:'return',saleId:'sale',productId:'p',storeId:'a',businessDateISO:'2026-10-09',amount:25,quantity:1,refundBreakdown:{cash:25,card:0,transfer:0}};
test('yesterday revenue is unchanged and today records cash refund independently',()=>{
 assert.equal(typeof reporting.financialSalesEvents,'function');
 const events=reporting.financialSalesEvents([sale],[ret]);
 const yesterday=events.filter(row=>reporting.recordDateKey(row)==='2026-10-08');
 const today=events.filter(row=>reporting.recordDateKey(row)==='2026-10-09');
 assert.equal(yesterday.reduce((sum,row)=>sum+reporting.saleNetRevenue(row),0),100);
 assert.equal(today.reduce((sum,row)=>sum+reporting.saleNetRevenue(row),0),-25);
 assert.equal(reporting.saleNetPaymentBreakdown(today[0]).cash,-25);
 assert.equal(reporting.saleNetPaymentBreakdown(yesterday[0]).card,100);
 assert.equal(reporting.saleNetProfit(today[0]),-15);
});
