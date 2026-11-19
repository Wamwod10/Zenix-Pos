import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftDurationMs,shiftDurationLabel} from '../src/pages/shifts/shiftDuration.js';
test('shift elapsed display never invents time for invalid or missing timestamps',()=>{
 const now=Date.parse('2026-11-19T06:10:00Z');
 for(const invalid of [undefined,null,'','invalid',0]){assert.equal(shiftDurationMs(invalid,now),null);assert.equal(shiftDurationLabel(shiftDurationMs(invalid,now)),'—');}
 assert.equal(shiftDurationLabel(shiftDurationMs('2026-11-19T04:35:00Z',now)),'1 soat 35 daqiqa');
 assert.equal(shiftDurationLabel(shiftDurationMs('2026-11-19T06:11:00Z',now)),'0 soat 0 daqiqa');
});
