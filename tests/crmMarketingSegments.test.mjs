import test from 'node:test';
import assert from 'node:assert/strict';
import {customerSegmentOptions,normalizeCustomerSegment,customerExportCsv} from '../src/pages/customers/customerSegments.js';
test('CRM customer type and loyalty tier segments remain distinct',()=>{
 for(const [id] of customerSegmentOptions)assert.equal(normalizeCustomerSegment(id),id);
 assert.equal(normalizeCustomerSegment('tier-unknown'),'all');
 assert.notEqual(normalizeCustomerSegment('vip'),normalizeCustomerSegment('tier-vip'));
});
test('marketing CSV preserves tiers, points and tags, neutralizes formula injection without deleting data',()=>{
 const csv=customerExportCsv([{name:'=1+1',phone:'+998901234567',customerType:'WHOLESALE',loyaltyTier:'GOLD',loyaltyPoints:24.5,balance:0,totalPurchases:120000,tags:['promo','=bad']}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"Loyalty darajasi"'));assert.ok(csv.includes('"GOLD","24.5"'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"\'+998901234567"'));assert.ok(csv.includes('"promo, =bad"'));
});
