import test from 'node:test';
import assert from 'node:assert/strict';
import {aiErrorMessage,aiMessageReports,aiReportContexts} from '../src/pages/ai/aiPresentation.js';
test('all server reports remain visible without duplicating the legacy last report',()=>{
 const first={topic:'stock',facts:[]},second={topic:'sales',facts:[]};
 assert.deepEqual(aiMessageReports({report:second,toolResults:[{result:{kind:'report',report:first}},{result:{kind:'report',report:second}}]}),[first,second]);
 assert.deepEqual(aiMessageReports({report:first}),[first]);assert.deepEqual(aiMessageReports({}),[]);
});
test('AI failures explain distinct recovery actions without exposing private details',()=>{
 const codes=['AI_PROVIDER_FAILURE','AI_INVALID_RESPONSE','AI_EVIDENCE_INVALID','AI_TOKEN_LIMIT','AI_TIMEOUT','AI_TOOL_TIMEOUT','AI_TOOL_FAILURE','AI_QUOTA_EXCEEDED','AI_CONVERSATION_EXPIRED','AI_FORBIDDEN'];
 const messages=codes.map(code=>aiErrorMessage({code,message:'private-provider-payload'}));
 assert.equal(new Set(messages).size,codes.length);assert.ok(messages.every(m=>!m.includes('private')));
 assert.match(aiErrorMessage({code:'AI_INVALID_RESPONSE',details:{reason:'token_exhaustion'}}),/qisqartir/);
});

test('AI only attributes periods and scope to authenticated server report evidence',()=>{
 const first={topic:'sales',storeId:'branch-1',from:'2026-11-01',to:'2026-11-07',sellerScoped:true,facts:[{id:'n1',from:'2026-10-25',to:'2026-10-31'}]};
 const second={topic:'stock',storeId:null,facts:[{id:'stock-1',label:'Qoldiq',value:'4'}]};
 const result=aiReportContexts({toolResults:[{result:{kind:'report',report:first}},{result:{kind:'report',report:second}}]});
 assert.deepEqual(result,[
  {periods:['2026-11-01 — 2026-11-07','2026-10-25 — 2026-10-31'],scope:'Tanlangan filial',ownSales:true},
  {periods:[],scope:'Ruxsat etilgan filiallar',ownSales:false},
 ]);
 assert.deepEqual(aiReportContexts({answer:'Hisobotsiz tavsiya'}),[],'no report means no invented reporting period or branch scope');
 assert.deepEqual(aiReportContexts({report:{topic:'recent',tables:[{title:'Haftalik',from:'2026-10-01',to:'2026-10-07'}]}}),
   [{periods:['2026-10-01 — 2026-10-07'],scope:'Ruxsat etilgan filiallar',ownSales:false}]);
});
