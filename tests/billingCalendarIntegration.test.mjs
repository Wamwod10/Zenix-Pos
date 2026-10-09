import test from 'node:test';
import assert from 'node:assert/strict';
import {billableMonths,priceExtraStoreByMonths} from '../src/config/billing.js';

test('extra-store UI quotes the complete calendar period beyond ten years',()=>{
  assert.equal(billableMonths('2026-10-08','2038-11-08'),145);
  assert.equal(priceExtraStoreByMonths('MONTHLY','2026-10-08','2038-11-08',2),34800000);
  assert.equal(billableMonths('2026-01-31','2026-02-28'),1);
  assert.equal(billableMonths('2026-01-31','2026-03-01'),2);
});
test('invalid and reversed calendar periods fail closed',()=>{
  for(const [from,to] of [['2026-02-31','2026-04-01'],['2026-01-01','2026-02-31'],['bad','2026-04-01'],['2026-04-01','2026-01-01']]){
    assert.equal(billableMonths(from,to),0);
  }
});
