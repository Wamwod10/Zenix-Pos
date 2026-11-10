import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedPosLayout,posCatalogVisible,posSearchResults,posPrimaryPaymentMethod} from '../src/pages/posPro/posLayout.js';

test('existing cashier layouts remain stable and quick layout is opt-in',()=>{
 assert.equal(normalizedPosLayout('classic'),'classic');
 assert.equal(normalizedPosLayout('touch'),'touch');
 assert.equal(normalizedPosLayout('quick'),'quick');
 for(const saved of [undefined,null,'','other','QUICK'])assert.equal(normalizedPosLayout(saved),'classic');
});

test('quick mode hides idle product grid until cashier searches or explicitly browses',()=>{
 assert.equal(posCatalogVisible({layout:'quick'}),false);
 assert.equal(posCatalogVisible({layout:'quick',search:'    '}),false);
 assert.equal(posCatalogVisible({layout:'quick',search:'Olma'}),true);
 assert.equal(posCatalogVisible({layout:'quick',search:'1234567890123'}),true);
 assert.equal(posCatalogVisible({layout:'quick',category:'Ichimlik'}),true);
 assert.equal(posCatalogVisible({layout:'quick',catalogMode:'popular'}),true);
 assert.equal(posCatalogVisible({layout:'quick',browse:true}),true);
 assert.equal(posCatalogVisible({layout:'quick',search:'',category:'',catalogMode:'all',browse:false}),false);
});

test('new cashier search does not display cached results from an older query',()=>{
 const old=[{id:'a',name:'Olma'},{id:'b',name:'Sut'}];
 assert.deepEqual(posSearchResults({products:old,catalogMode:'all',search:'new',searchReady:false}),[]);
 assert.deepEqual(posSearchResults({products:old,catalogMode:'all',search:'new',searchReady:true}),old);
 assert.deepEqual(posSearchResults({products:old,catalogMode:'popular',search:'',searchReady:false}),old);
 assert.deepEqual(posSearchResults({products:old,catalogMode:'all',search:'',searchReady:false}),[]);
 assert.deepEqual(posSearchResults({products:old,catalogMode:'all',search:'',searchReady:true}),old);
 assert.deepEqual(posSearchResults({products:old,catalogMode:'all',category:'Ichimlik',searchReady:false}),[]);
 assert.deepEqual(posSearchResults({products:old,catalogMode:'all',category:'',searchReady:false}),[],'clearing a category cannot expose the previous category as full catalog');
 assert.equal(old.length,2,'original scoped catalog cache is not mutated');
});

test('F12 primary checkout respects disabled cash and all workspace payment limits',()=>{
 assert.equal(posPrimaryPaymentMethod(), 'cash');
 assert.equal(posPrimaryPaymentMethod({cash:false,card:true}), 'card');
 assert.equal(posPrimaryPaymentMethod({cash:false,card:false,transfer:true}), 'transfer');
 assert.equal(posPrimaryPaymentMethod({cash:false,card:false,transfer:false,split:true}), 'split');
 assert.equal(posPrimaryPaymentMethod({cash:false,card:false,transfer:false,split:false,credit:true},true),'credit');
 assert.equal(posPrimaryPaymentMethod({cash:false,card:false,transfer:false,split:false,credit:true},false),null);
 assert.equal(posPrimaryPaymentMethod({cash:false,card:false,transfer:false,split:false,credit:false}),null);
 assert.equal(posPrimaryPaymentMethod(null), 'cash');
});

test('classic and touch still show full catalog; no stock or checkout business logic is changed',()=>{
 for(const layout of ['classic','touch'])for(const query of ['', 'olma']){
  assert.equal(posCatalogVisible({layout,search:query}),true);
 }
 assert.equal(posCatalogVisible(),true);
 const pos=readFileSync(new URL('../src/pages/posPro/PosPro.jsx',import.meta.url),'utf8');
 const header=readFileSync(new URL('../src/pages/posPro/WorkspaceHeader.jsx',import.meta.url),'utf8');
 assert.match(header,/<option value="quick">Tezkor kassa/);
 assert.match(pos,/const catalogVisible=posCatalogVisible/);
 assert.match(pos,/catalogMode==='popular'\|\|!posCatalogVisible\(/,'idle Quick and popular mode must not fetch unnecessary catalog pages');
 assert.match(pos,/\[layout,search,category,catalogMode,browseCatalog,catalog\.search\]/,'switching mode or browse state must refresh scoped catalog');

 assert.match(pos,/hidden=\{!catalogVisible\}/);
 assert.match(pos,/catalog\.barcode\(code\)/);
 assert.match(pos,/session\.add\(product\)/);
 assert.match(pos,/onClick=\{openPrimaryPayment\}/);
 assert.match(pos,/F12:\(\)=>actions\.current\.openPrimaryPayment\(\)/);
 assert.match(pos,/!primaryPaymentMethod\|\|session\.locked/);

});
