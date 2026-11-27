import test from 'node:test';import assert from 'node:assert/strict';
import {saleGrossPaymentBreakdown,saleNetPaymentBreakdown} from '../src/utils/reporting.js';
import {validateRedemptionQuote,loyaltyPaymentAmount} from '../src/pages/posPro/loyaltyPayment.js';
test('loyalty quote and payable monetary total are exact',()=>{
 const q={enabled:true,maxPoints:10,points:3,amount:300,remaining:700.01};
 assert.equal(validateRedemptionQuote(q,1000.01,3),q);
 assert.equal(loyaltyPaymentAmount(1000.01,{points:3,amount:300},'cash'),700.01);
 assert.equal(loyaltyPaymentAmount(300,{points:3,amount:300},'cash'),0);
 for(const change of [{amount:300.001},{remaining:700},{points:4},{enabled:false},{maxPoints:2}])assert.throws(()=>validateRedemptionQuote({...q,...change},1000.01,3));
 assert.throws(()=>loyaltyPaymentAmount(1000,{points:3,amount:300},'credit'));
});

test('locally confirmed loyalty tender cannot inflate actual monetary receipts',()=>{
 const sale={total:1000,saleTotal:1000,returnedTotal:0,paymentMethod:'cash',paymentBreakdown:{cash:700,loyalty:300},loyaltyRedemption:{points:3,amount:300}};
 assert.deepEqual(saleGrossPaymentBreakdown(sale),{cash:700,card:0,transfer:0});
 assert.deepEqual(saleNetPaymentBreakdown(sale),{cash:700,card:0,transfer:0});
 assert.deepEqual(saleNetPaymentBreakdown({...sale,returnedTotal:500}),{cash:350,card:0,transfer:0});
});
