import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCustomerProfilePayload} from '../src/pages/customers/customerState.js';
import {DEFAULT_ROLE_PERMISSIONS} from '../src/config/uiDefaults.js';
const form={name:' Customer ',phone:' 123 ',email:' ',address:' ',note:'Contact note',tags:['VIP'],creditLimit:'250',defaultCreditDays:'30',customerType:'VIP',loyaltyTier:'GOLD',balance:500,id:'x'};
test('contact edits omit protected settings and read-only response fields',()=>{
 assert.deepEqual(buildCustomerProfilePayload(form,false),{name:'Customer',phone:'123',email:'',address:'',note:'Contact note',tags:['VIP']});
});
test('authorized profile payload includes financial settings',()=>{
 const payload=buildCustomerProfilePayload(form,true);
 for(const key of ['creditLimit','defaultCreditDays','customerType','loyaltyTier'])assert.equal(payload[key],form[key]);
 assert.equal(payload.balance,undefined);
});
test('frontend financial defaults match least privilege policy',()=>{
 for(const [role,permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS))assert.equal(permissions.customerFinancialWrite,['OWNER','ADMIN'].includes(role));
});
