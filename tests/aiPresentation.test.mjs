import test from 'node:test';
import assert from 'node:assert/strict';
import {aiState,aiSuggestions,shouldFollowChat,aiProgressLabel,aiMessageBlocks,aiFactValue} from '../src/pages/ai/aiPresentation.js';

test('business facts format exact money and package units without numeric conversion',()=>{
 assert.equal(aiFactValue({value:'69000.00',unit:'UZS'}),'69 000.00 so‘m');
 assert.equal(aiFactValue({value:'9007199254740993.123456',unit:'UZS'}),'9 007 199 254 740 993.123456 so‘m');
 assert.equal(aiFactValue({value:'-12500.25',unit:'UZS'}),'-12 500.25 so‘m');
 assert.equal(aiFactValue({value:'2.000',unit:'piece'}),'2.000 dona');
 assert.equal(aiFactValue({value:'TEST-014',unit:'text'}),'TEST-014');
 assert.equal(aiFactValue({value:'2026-10-14T10:00:00Z',unit:'datetime'}),'2026-10-14T10:00:00Z');
});

test('quantity facts retain units and unknown quantities stay unknown',()=>{
 assert.equal(aiFactValue({value:'1.627',unit:'kg'}),'1.627 kg');
 assert.equal(aiFactValue({value:'2',unit:'dona'}),'2 dona');
 assert.equal(aiFactValue({value:null,unit:'kg'}),'Ma’lumot yetarli emas');
});

test('progress labels use only recognized server phases',()=>{
 for(const phase of ['understanding','reading_sales','reading_inventory','preparing_action','composing','verifying','complete','failed'])assert.notEqual(aiProgressLabel(phase),'Javob tayyorlanmoqda…');
 for(const phase of [null,undefined,'invented','toString'])assert.equal(aiProgressLabel(phase),'Javob tayyorlanmoqda…');
});
test('message blocks safely map supported text and facts while preserving legacy messages',()=>{
 assert.deepEqual(aiMessageBlocks({answer:'legacy'}),[]);
 assert.deepEqual(aiMessageBlocks({blocks:{type:'facts'}}),[]);
 assert.deepEqual(aiMessageBlocks({blocks:[null,{type:'html',text:'unsafe'},{type:'paragraph',text:'<b>plain</b>'},{type:'facts',facts:[{id:'a',text:'Sales: 5',html:'ignored'},{id:1,text:'bad'},null]},{type:'recommendation',text:4}]}),[{type:'paragraph',text:'<b>plain</b>',facts:[]},{type:'facts',text:'',facts:[{id:'a',text:'Sales: 5'}]}]);
});

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
