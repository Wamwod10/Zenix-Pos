import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedPosLayout,posCatalogVisible,posSearchResults,posPrimaryPaymentMethod,posPrimaryPaymentLabel} from '../src/pages/posPro/posLayout.js';

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
 assert.equal(posPrimaryPaymentLabel('cash'),'Naqd to‘lov');
 assert.equal(posPrimaryPaymentLabel('card'),'Karta orqali to‘lov');
 assert.equal(posPrimaryPaymentLabel('transfer'),'O‘tkazma orqali to‘lov');
 assert.equal(posPrimaryPaymentLabel('split'),'Aralash to‘lov');
 assert.equal(posPrimaryPaymentLabel('credit'),'Nasiya savdo');
 assert.equal(posPrimaryPaymentLabel(null),'To‘lov usuli mavjud emas');
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

// Stable source-level UX guards for the intentionally compact POS Pro layout.
test('responsive cashier layout keeps the mobile reading and keyboard order aligned',()=>{
 const touch=readFileSync(new URL('../src/pages/posPro/touchPos.scss',import.meta.url),'utf8');
 const classic=readFileSync(new URL('../src/pages/posPro/posPro.scss',import.meta.url),'utf8');
 const quick=readFileSync(new URL('../src/pages/posPro/posQuick.scss',import.meta.url),'utf8');
 const pos=readFileSync(new URL('../src/pages/posPro/PosPro.jsx',import.meta.url),'utf8');
 assert.match(touch,/\.pp-cart\{order:2;height:420px\}/);
 assert.match(touch,/\.pp-catalog\{order:1;display:flex/);
 assert.match(touch,/\.pp-touch-console\{order:3;overflow:visible/);
 assert.match(touch,/\.pp-terminal\{order:4;overflow:visible/);
 assert.doesNotMatch(touch,/\.pp-terminal\{order:2\}/);
 assert.match(touch,/max-height:760px/);
 assert.match(classic,/grid-template-columns:minmax\(138px,1fr\) 54px 44px/);
 assert.match(quick,/\.pp-quick-intro \{flex:none;min-height:0/);
 assert.match(pos,/aria-pressed=\{catalogMode==='all'&&catalogVisible\}/);
 assert.match(pos,/closeQuick=layout==='quick'&&catalogMode==='all'&&catalogVisible/);
});

// UI regression guard: mobile cashier can reach the same existing payment
// terminal without creating a second checkout path.
test('mobile payment jump and compact payment controls keep financial logic unchanged',()=>{
 const cart=readFileSync(new URL('../src/pages/posPro/Cart.jsx',import.meta.url),'utf8');
 const pos=readFileSync(new URL('../src/pages/posPro/PosPro.jsx',import.meta.url),'utf8');
 const payment=readFileSync(new URL('../src/pages/posPro/Payment.jsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/pages/posPro/posPro.scss',import.meta.url),'utf8');
 const touch=readFileSync(new URL('../src/pages/posPro/touchPos.scss',import.meta.url),'utf8');
 assert.match(cart,/pp-mobile-checkout-jump/);
 assert.match(cart,/aria-controls="pp-payment-terminal"/);
 assert.match(pos,/id="pp-payment-terminal"/);
 assert.match(pos,/scrollIntoView\\(\\{block:'start',behavior:'auto'\\}\\)/);
 assert.match(payment,/method!=='credit'&&<p className="pp-change"/);
 assert.match(payment,/paymentPlan\\(input\\)/);
 assert.match(css,/\\.pp-quick-money \\{display:grid;grid-template-columns:repeat\\(3/);
 assert.match(touch,/max-height:700px/);
 assert.match(touch,/grid-template-rows:minmax\\(210px,1fr\\) minmax\\(246px,1fr\\) auto/);
});
