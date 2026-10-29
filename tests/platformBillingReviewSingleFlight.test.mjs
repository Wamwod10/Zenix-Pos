import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Super Admin billing approval and rejection remain single-flight with a safe unlock',()=>{
  const source=readFileSync(new URL('../src/pages/platformAdmin/PlatformAdmin.jsx',import.meta.url),'utf8');
  const start=source.indexOf('  const update=async(payment,next)=>{');
  const end=source.indexOf('  const openReceipt=',start);
  assert.ok(start>=0&&end>start);
  const action=source.slice(start,end);
  const lock=action.indexOf('if(!paymentId||reviewInFlightRef.current)return;');
  const set=action.indexOf('reviewInFlightRef.current=paymentId;');
  const prompt=action.indexOf('await confirm(');
  const request=action.indexOf('await commitBillingReview(');
  assert.ok(lock>=0&&set>lock&&prompt>set&&request>prompt,'guard must precede confirmation and request');
  assert.match(action,/finally\s*\{\s*reviewInFlightRef\.current=null;\s*setReviewBusyId\(null\);/);
  assert.match(source,/aria-label="To‘lovni tasdiqlash" disabled=\{!!reviewBusyId\}/);
  assert.match(source,/aria-label="To‘lovni rad etish" disabled=\{!!reviewBusyId\}/);
  assert.match(source,/disabled=\{!reason\.trim\(\)\|\|!!reviewBusyId\}/);
});
