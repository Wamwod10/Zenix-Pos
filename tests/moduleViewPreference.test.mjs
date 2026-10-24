import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleViewKey, readModuleView } from '../src/utils/moduleViewPreference.js';
test('view preferences isolate organization, user and module without delimiter collisions',()=>{
 const keys=[moduleViewKey('inventory','a','b'),moduleViewKey('suppliers','a','b'),moduleViewKey('inventory','c','b'),moduleViewKey('inventory','a','d'),moduleViewKey('inventory','a:b','c'),moduleViewKey('inventory','a','b:c')];
 assert.equal(new Set(keys).size,keys.length);
});
test('saved list and grid restore; invalid or unavailable storage falls back to cards',()=>{
 for(const view of ['list','grid'])assert.equal(readModuleView({getItem:()=>view},'key'),view);
 for(const view of [null,'bad',''])assert.equal(readModuleView({getItem:()=>view},'key'),'grid');
 assert.equal(readModuleView({getItem(){throw Error('blocked')}},'key'),'grid');
 assert.equal(readModuleView(undefined,'key'),'grid');
});
