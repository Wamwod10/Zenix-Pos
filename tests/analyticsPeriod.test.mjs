import test from 'node:test';
import assert from 'node:assert/strict';
import {periodRange, recordInPeriod} from '../src/utils/reporting.js';
import {filterAnalyticsPeriod} from '../src/pages/analytics/analyticsPeriod.js';

test('Analytics filters against one date snapshot preserving boundaries, business dates and undated all-time records',async()=>{
  const records=[
    {id:'start',dateISO:'2026-10-01'}, {id:'end',dateISO:'2026-10-16'},
    {id:'before',dateISO:'2026-09-30'}, {id:'after',dateISO:'2026-10-17'},
    {id:'business',businessDateISO:'2026-10-16',dateISO:'2026-10-17'},
    {id:'timestamp',createdAt:'2026-09-30T20:00:00Z'}, {id:'invalid',date:'invalid'}, {id:'missing'},
  ];
  assert.deepEqual(filterAnalyticsPeriod(records,{from:'2026-10-01',to:'2026-10-16'},'Asia/Tashkent').map(x=>x.id),['start','end','business','timestamp']);
  const NativeDate=globalThis.Date;
  let clockReads=0;
  globalThis.Date=class extends NativeDate {constructor(...args){if(!args.length)clockReads++;super(...args);}};
  try {filterAnalyticsPeriod(records,{from:'2026-10-01',to:'2026-10-16'},'UTC');}finally{globalThis.Date=NativeDate;}
  assert.equal(clockReads,0,'Filtering with a supplied range must not read the clock for each row');
  assert.deepEqual(filterAnalyticsPeriod(records,{from:'',to:''},'UTC'),records);
  assert.deepEqual(filterAnalyticsPeriod(records,{from:'2026-10-17',to:'2026-10-01'},'UTC'),[]);
  assert.equal(filterAnalyticsPeriod(records,{from:'2026-10-01',to:'2026-10-16'},'UTC')[0],records[0]);
});

test('Analytics range snapshot matches existing presets with workspace business days and timezone changes',()=>{
  const records=[{dateISO:'2000-01-01'},{dateISO:'2099-01-01'},{},{date:'bad'},
    {createdAt:new Date().toISOString()},{businessDateISO:'2026-10-15',dateISO:'2026-10-16'}];
  for(const timezone of ['UTC','Asia/Tashkent','America/New_York']){
    for(const period of ['Bugun','7 kun','30 kun','Bu oy','Custom','all']){
      const options={timezone,from:'2026-10-01',to:'2026-10-16',businessDay:{startTime:'04:00'}};
      assert.deepEqual(filterAnalyticsPeriod(records,periodRange(period,options),timezone),records.filter(record=>recordInPeriod(record,period,options)),`${period}/${timezone}`);
    }
  }
});
