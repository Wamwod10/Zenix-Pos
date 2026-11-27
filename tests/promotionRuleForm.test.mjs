import test from 'node:test';import assert from 'node:assert/strict';import {buildPromotionRule,promotionRuleForm} from '../src/pages/settings/promotionRuleForm.js';
const id='11111111-1111-4111-8111-111111111111',productId='22222222-2222-4222-8222-222222222222';
const form={...promotionRuleForm(),productId,startsAt:'2026-11-27T10:00',endsAt:'2026-12-01T10:00'};
test('new rules are disabled, UTC dates and exact quantity discount serialize safely',()=>{
 const r=buildPromotionRule(form,id);assert.equal(r.enabled,false);assert.equal(r.buy,2);assert.equal(r.startsAt,'2026-11-27T10:00:00.000Z');
 const pct=buildPromotionRule({...form,kind:'QUANTITY_PERCENT',percent:'12.25'},id);assert.equal(pct.discountBps,1225);assert.equal(promotionRuleForm(pct).percent,12.25);
});
test('invalid date, percent, quantities and product are rejected',()=>{
 for(const override of [{startsAt:'2026-02-30T10:00'},{endsAt:form.startsAt},{buy:0},{productId:'invalid'},{kind:'QUANTITY_PERCENT',percent:'12.345'}])assert.throws(()=>buildPromotionRule({...form,...override},id));
});
