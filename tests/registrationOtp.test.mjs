import test from 'node:test';
import assert from 'node:assert/strict';
import { otpPhone, otpRemaining, canRegisterTrial } from '../src/utils/registrationOtp.js';

test('verified token is bound to the exact Uzbekistan phone and expires',()=>{
  const proof={phone:'+998901234567',registrationToken:'opaque',expiresAt:'2026-10-10T12:05:00Z'};
  const now=Date.parse('2026-10-10T12:00:00Z');
  assert.equal(otpPhone('+998 90 123 45 67'),proof.phone);
  assert.equal(canRegisterTrial(proof,'+998 90 123 45 67',now),true);
  assert.equal(canRegisterTrial(proof,'+998 90 123 45 68',now),false);
  assert.equal(canRegisterTrial(proof,proof.phone,now+300000),false);
  assert.equal(canRegisterTrial({...proof,registrationToken:''},proof.phone,now),false);
  assert.equal(otpPhone('+997901234567'),'');
});
test('OTP cooldown rounds up and never becomes negative',()=>{
  assert.equal(otpRemaining(1501,1000),1);
  assert.equal(otpRemaining(1000,1001),0);
  assert.equal(otpRemaining('invalid',1000),0);
});
