import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/context/StoreContext.jsx',import.meta.url),'utf8');
const project=vm.runInNewContext(source.slice(source.indexOf('const projectInventory ='),source.indexOf('export const productFromApi=')).replace('const projectInventory =','globalThis.projectInventory ='),{number:(v,f)=>Number(v??f),DEFAULT_STORE_ID:'a'});
test('branch valuations use independent averages including genuine zero',()=>{
 const item={costPrice:99,stockByStore:{a:10,b:20},costByStore:{a:0,b:15}};
 const a=project([item],'a')[0],b=project([item],'b')[0];
 assert.equal(a.costPrice,0);assert.equal(b.costPrice,15);assert.equal(a.quantity*a.costPrice,0);assert.equal(b.quantity*b.costPrice,300);
 assert.equal(a.referenceCostPrice,99);assert.equal(item.costPrice,99);
});

test('contact-only product edits preserve reference cost rather than branch valuation',()=>{
 const productSource=fs.readFileSync(new URL('../src/pages/products/Products.jsx',import.meta.url),'utf8');
 const expression=productSource.match(/payload:\{\.\.\.payload,costPrice:([^}]+)\}/)[1];
 const submittedCost=Function('editing',`return ${expression}`);
 assert.equal(submittedCost({referenceCostPrice:99,costPrice:10}),99);
 assert.equal(submittedCost({referenceCostPrice:0,costPrice:15}),0);
 assert.equal(submittedCost({costPrice:15}),15);
});

test('progressive POS catalog uses the same branch cost including zero',()=>{
 const hook=fs.readFileSync(new URL('../src/pages/posPro/useProCatalog.js',import.meta.url),'utf8');
 const expression=hook.match(/costPrice:Number\(([^)]+)\),quantity/)[1];
 const cost=Function('p','storeId',`return Number(${expression})`);
 assert.equal(cost({costPrice:99,costByStore:{a:0,b:15}},'a'),0);
 assert.equal(cost({costPrice:99,costByStore:{a:0,b:15}},'b'),15);
 assert.equal(cost({costPrice:99},'c'),99);
 assert.match(hook,/referenceCostPrice:p.referenceCostPrice\?\?p.costPrice/);
});
