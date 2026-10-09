import test from 'node:test';
import assert from 'node:assert/strict';
import {coveredExtraStoresForPeriod} from '../src/pages/billing/extraStoreCoverage.js';

test('future renewal never credits passes expiring midway through renewed period',()=>{
  const passes=[
    {quantity:1,startsOn:'2026-10-01',expiresOn:'2026-11-01'},
    {quantity:2,startsOn:'2026-10-01',expiresOn:'2027-11-01'},
  ];
  assert.equal(coveredExtraStoresForPeriod(passes,'2026-11-01','2027-11-01'),2);
  assert.equal(coveredExtraStoresForPeriod(passes,'2026-11-01','2027-12-01'),0);
});
test('endpoints and invalid entitlements never inflate discounted branch coverage',()=>{
  assert.equal(coveredExtraStoresForPeriod([
    {quantity:2,startsOn:'2026-01-01',expiresOn:'2026-12-31'},
    {quantity:-3,startsOn:'2026-01-01',expiresOn:'2027-12-31'},
    {quantity:100,startsOn:'2026-01-01',expiresOn:'2027-12-31'},
  ],'2026-01-01','2026-12-31'),2);
  assert.equal(coveredExtraStoresForPeriod([], '2026-01-02','2026-01-01'),0);
});
