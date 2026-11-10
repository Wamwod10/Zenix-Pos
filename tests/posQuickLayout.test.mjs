import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedPosLayout,posCatalogVisible} from '../src/pages/posPro/posLayout.js';

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

test('classic and touch still show full catalog; no stock or checkout business logic is changed',()=>{
 for(const layout of ['classic','touch'])for(const query of ['', 'olma']){
  assert.equal(posCatalogVisible({layout,search:query}),true);
 }
 assert.equal(posCatalogVisible(),true);
 const pos=readFileSync(new URL('../src/pages/posPro/PosPro.jsx',import.meta.url),'utf8');
 const header=readFileSync(new URL('../src/pages/posPro/WorkspaceHeader.jsx',import.meta.url),'utf8');
 assert.match(header,/<option value="quick">Tezkor kassa/);
 assert.match(pos,/const catalogVisible=posCatalogVisible/);
 assert.match(pos,/if\(!posCatalogVisible\(\{layout,search,category,catalogMode,browse:browseCatalog\}\)\)return;/,'idle Quick must not fetch catalog pages');
 assert.match(pos,/\[layout,search,category,catalogMode,browseCatalog,catalog\.search\]/,'switching mode or browse state must refresh scoped catalog');

 assert.match(pos,/hidden=\{!catalogVisible\}/);
 assert.match(pos,/catalog\.barcode\(code\)/);
 assert.match(pos,/session\.add\(product\)/);
 assert.match(pos,/onClick=\{\(\)=>openPayment\('cash'\)\}/);
});
