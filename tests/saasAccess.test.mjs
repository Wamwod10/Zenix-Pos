import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceAccessState } from '../src/utils/license.js';

test('exact trial expiration and billing holds close operational modules',()=>{
  const organization={licenseStatus:'ACTIVE',expiryDate:'2099-01-01',settings:{trialEndsAt:'2026-10-09T10:00:00Z'}};
  assert.equal(workspaceAccessState({organization,now:Date.parse('2026-10-09T09:59:59Z')}).allowed,true);
  assert.equal(workspaceAccessState({organization,now:Date.parse('2026-10-09T10:00:00Z')}).reason,'EXPIRED');
  assert.equal(workspaceAccessState({organization:{...organization,settings:{billingHold:true}}}).reason,'BILLING_HOLD');
});
test('license calendar uses business timezone rather than browser timezone',()=>{
  assert.equal(workspaceAccessState({organization:{licenseStatus:'ACTIVE',expiryDate:'2026-10-09',timezone:'Asia/Tashkent'},now:Date.parse('2026-10-09T20:00:00Z')}).reason,'EXPIRED');
});
