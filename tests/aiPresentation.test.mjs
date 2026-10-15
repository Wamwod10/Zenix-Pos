import test from 'node:test';
import assert from 'node:assert/strict';
import {aiState,aiSuggestions,shouldFollowChat} from '../src/pages/ai/aiPresentation.js';

test('AI status uses server state and keeps provider OFF ahead of tariff and errors',()=>{
 assert.equal(aiState({enabled:false,limit:0,writable:false},true,'offline').key,'off');
 assert.equal(aiState(null,true).key,'loading');
 assert.equal(aiState(null,false,'offline').key,'error');
 assert.equal(aiState({enabled:true,limit:0,writable:true}).key,'plan');
 assert.equal(aiState({enabled:true,limit:100,writable:false}).key,'expired');
 assert.equal(aiState({enabled:true,limit:100,writable:true,remaining:0}).key,'quota');
 assert.equal(aiState({enabled:true,limit:100,writable:true,remaining:2},true).key,'busy');
 assert.equal(aiState({enabled:true,limit:100,writable:true,remaining:2}).key,'ready');
});
test('welcome suggestions respect server topics, module permissions and write feature flag',()=>{
 const all={suggestions:[{topic:'today_sales'},{topic:'low_stock'},{topic:'profit'}],writesEnabled:true};
 assert.equal(aiSuggestions(all,()=>true).length,4);
 assert.equal(aiSuggestions({...all,writesEnabled:false},()=>true).length,3);
 assert.equal(aiSuggestions({suggestions:[],writesEnabled:true},()=>false).length,0);
 assert.deepEqual(aiSuggestions({suggestions:[],writesEnabled:false},p=>p==='moduleInventory').map(c=>c.id),['stock']);
 assert.equal(aiSuggestions(null,()=>true).length,0,'never invent server capabilities before loading');
});
test('incoming replies do not move readers away from older messages',()=>{
 assert.equal(shouldFollowChat({scrollHeight:1000,scrollTop:200,clientHeight:400}),false);
 assert.equal(shouldFollowChat({scrollHeight:1000,scrollTop:550,clientHeight:400}),true);
});
