import test from 'node:test';
import assert from 'node:assert/strict';
import {annualSaving,subscriptionAction,subscriptionSummary,subscriptionDraftUsable} from '../src/utils/subscription.js';
import {workspaceAccessState} from '../src/utils/license.js';
test('annual savings use actual server prices and preserve financial precision',()=>{
  for(const [monthly,annual,saving] of [[250000,2500000,500000],[350000,3300000,900000],[590000,5900000,1180000]])assert.equal(annualSaving({prices:{MONTHLY:monthly,ANNUAL:annual}}).amount,saving);
});
test('trial switch, activation, renewal, upgrade and downgrade are distinct actions',()=>{
  const plans=[{code:'START',rank:1},{code:'BUSINESS',rank:2},{code:'PREMIUM',rank:3}];
  const current={planCode:'BUSINESS',accessMode:'READ_WRITE',billingInterval:'MONTHLY'};
  assert.equal(subscriptionAction(current,'START',plans),'DOWNGRADE');assert.equal(subscriptionAction(current,'PREMIUM',plans),'UPGRADE');assert.equal(subscriptionAction(current,'BUSINESS',plans),'RENEW');
  assert.equal(subscriptionAction({...current,trialEndsAt:'2099-01-01'},'START',plans),'TRIAL');
  assert.equal(subscriptionAction({...current,accessMode:'READ_ONLY'},'PREMIUM',plans),'ACTIVATE');
});
test('checkout totals are exclusively the persisted backend quote',()=>{
  const draft={totalAmount:123.45,baseAmount:150,creditAmount:100,metadata:{subscription:{grossAmount:250,planCode:'START',billingInterval:'MONTHLY'},promoDiscount:26.55}};
  assert.deepEqual(subscriptionSummary(draft),{planCode:'START',billingInterval:'MONTHLY',gross:250,credit:100,discount:26.55,total:123.45});
  assert.equal(subscriptionSummary(null),null);
});
test('expired trial is readable while suspended workspace remains closed',()=>{
  const access=workspaceAccessState({organization:{licenseStatus:'ACTIVE',settings:{trialEndsAt:'2020-01-01'}}});assert.equal(access.allowed,true);assert.equal(access.readOnly,true);assert.equal(access.reason,'EXPIRED');
  assert.equal(workspaceAccessState({organization:{licenseStatus:'SUSPENDED'}}).allowed,false);
});
test('payment instructions expire with server version, draft deadline or Tashkent upgrade day',()=>{
  const now=Date.parse('2026-10-12T18:59:00Z'),state={version:5};
  const draft={expiresAt:'2026-10-13T20:00:00Z',metadata:{subscription:{subscriptionVersion:5,action:'UPGRADE',pricingDay:'2026-10-12'}}};
  assert.equal(subscriptionDraftUsable(draft,state,now),true);
  assert.equal(subscriptionDraftUsable(draft,{version:6},now),false);
  assert.equal(subscriptionDraftUsable(draft,state,now+60000),false);
  assert.equal(subscriptionDraftUsable({...draft,expiresAt:new Date(now).toISOString()},state,now),false);
});
