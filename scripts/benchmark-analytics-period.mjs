// Synthetic CPU-only Analytics date filtering; no API/database access.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {periodRange, recordInPeriod} from '../src/utils/reporting.js';
const optimized=process.argv.includes('--optimized');
const helper=optimized?await import('../src/pages/analytics/analyticsPeriod.js'):null;
const options={timezone:'Asia/Tashkent',businessDay:{startTime:'04:00'}};
const range=periodRange('30 kun',options);
for(const size of [1000,10000]){
  const records=Array.from({length:size},(_,i)=>({id:i,businessDateISO:i%3?range.to:'2000-01-01',amount:i+.25}));
  const run=()=>optimized?helper.filterAnalyticsPeriod(records,range,options.timezone):records.filter(record=>recordInPeriod(record,'30 kun',options));
  assert.equal(run().length,records.filter(record=>record.businessDateISO===range.to).length);
  for(let i=0;i<3;i++)run();
  const samples=[];
  for(let i=0;i<30;i++){const start=performance.now();run();samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);
  console.log(JSON.stringify({mode:optimized?'range-snapshot':'baseline',size,samples:30,p50:samples[14],p95:samples[28],p99:samples[29]}));
}
