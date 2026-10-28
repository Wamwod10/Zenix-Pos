import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidCalendarDateISO,isAcceptableCreditDueDate} from '../src/utils/creditDueDate.js';

test('both POS modes reject invalid Gregorian days',()=>{
 for(const date of [null,'','2026-02-30','2026-02-29','2026-13-01','2026-01-00','2026-11-31','0000-01-01','2026-1-02','2026-12-01T00:00:00Z']){
  assert.equal(isValidCalendarDateISO(date),false,String(date));
 }
 for(const date of ['2024-02-29','2028-02-29','2026-10-28','2026-12-31']){
  assert.equal(isValidCalendarDateISO(date),true,date);
 }
});
test('date-only comparison prevents past credit terms, permits today and future',()=>{
 const today='2026-10-28';
 assert.equal(isAcceptableCreditDueDate('2026-10-27',today),false);
 assert.equal(isAcceptableCreditDueDate('2026-10-28',today),true);
 assert.equal(isAcceptableCreditDueDate('2027-01-01',today),true);
 assert.equal(isAcceptableCreditDueDate('2026-02-30',today),false);
});
