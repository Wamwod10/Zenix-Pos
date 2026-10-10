import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScopedReport} from '../src/utils/scopedReport.js';
import {financialSalesEvents} from '../src/utils/reporting.js';

test('report loader respects server scope and reads all paginated detail without a 3000 cap',async()=>{
  const paths=[];
  const result=await loadScopedReport(async(path)=>{
    paths.push(path);
    const q=new URLSearchParams(path.split('?')[1]),offset=Number(q.get('offset')||0);
    return {aggregate:{saleCount:3001},sales:Array.from({length:Math.min(500,3001-offset)},(_,i)=>({id:offset+i})),returns:[],pagination:{offset,limit:500,total:3001,hasMore:offset+500<3001}};
  },{storeId:'scope',from:'2026-10-08',to:'2026-10-09'},{allPages:true});
  assert.equal(result.sales.length,3001);
  assert.equal(paths.length,7);
  assert.ok(paths.every(path=>path.startsWith('/api/finance?')));
  assert.ok(paths.every(path=>path.includes('storeId=scope')&&path.includes('from=2026-10-08')));
});

test('refund financial event belongs to refund actor while original seller remains auditable',()=>{
  const events=financialSalesEvents([{id:'sale',sellerId:'seller-a',sellerName:'Original',total:100000,items:[]}],[{id:'refund',saleId:'sale',createdBy:'actor-b',actorName:'Refund actor',amount:40000,quantity:1,businessDateISO:'2026-10-09'}]);
  assert.equal(events[1].sellerId,'actor-b');
  assert.equal(events[1].sellerName,'Refund actor');
  assert.equal(events[1].originalSellerId,'seller-a');
});

test('history loader fetches one detail page and keeps aggregate independent of page size',async()=>{
  let calls=0;
  const result=await loadScopedReport(async()=>{calls++;return {sales:[{id:'first'}],returns:[],aggregate:{saleCount:3001},pagination:{offset:0,limit:100,hasMore:true}};},{limit:100});
  assert.equal(calls,1);
  assert.equal(result.aggregate.saleCount,3001);
});
