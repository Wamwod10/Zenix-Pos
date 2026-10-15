import test from 'node:test';
import assert from 'node:assert/strict';
import {aiErrorMessage,aiMessageReports} from '../src/pages/ai/aiPresentation.js';
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
