// Broad CI regression budgets, not production UX/hosting guarantees.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {createPosCatalogSearch,searchPosCatalog} from '../src/utils/posCatalogSearch.js';
import {reconcilePersistedCart} from '../src/utils/posCartReconciliation.js';
import {filterAnalyticsPeriod} from '../src/pages/analytics/analyticsPeriod.js';
const products=Array.from({length:50000},(_,i)=>({id:String(i),name:`Guruch ${i}`,sku:`SKU-${i}`,barcode:String(i),category:'Food',sellPrice:12500,stockByStore:{test:100}}));
const index=createPosCatalogSearch(products),map=new Map(products.map(p=>[p.id,p]));
const lines=products.slice(-10).map(p=>({...p,cartQty:1}));
const records=products.slice(0,10000).map(p=>({id:p.id,businessDateISO:'2026-10-16'}));
const measure=(name,run,budgetMs)=>{
 for(let i=0;i<5;i++)run();
 const samples=[];for(let i=0;i<30;i++){const start=performance.now();run();samples.push(performance.now()-start)}
 samples.sort((a,b)=>a-b);const p95=samples[28];
 assert.ok(p95<budgetMs,`${name} P95 ${p95.toFixed(2)}ms exceeds ${budgetMs}ms`);
 return {name,p50:samples[14],p95,p99:samples[29],budgetMs};
};
const results=[
 measure('50k POS search',()=>assert.equal(searchPosCatalog(index,'Guruch 49999','all')[0],products[49999]),100),
 measure('10-line cart / 50k map',()=>assert.equal(reconcilePersistedCart({lines,products:map,storeId:'test'}).lines.length,10),5),
 measure('10k Analytics range',()=>assert.equal(filterAnalyticsPeriod(records,{from:'2026-10-01',to:'2026-10-31'},'UTC').length,10000),50),
];
if(process.argv.includes('--bundle')){
 const dir='dist/assets',files=fs.readdirSync(dir).filter(name=>name.endsWith('.js'));
 const chunks=files.map(name=>({name,gzipBytes:gzipSync(fs.readFileSync(path.join(dir,name))).length}));
 const total=chunks.reduce((sum,c)=>sum+c.gzipBytes,0),main=chunks.find(c=>/^index-/.test(c.name));
 assert.ok(main,'main entry chunk missing');
 assert.ok(main.gzipBytes<130000,`main gzip ${main.gzipBytes} exceeds 130000 bytes`);
 assert.ok(total<470000,`total gzip ${total} exceeds 470000 bytes`);
 results.push({bundle:{mainGzipBytes:main.gzipBytes,totalGzipBytes:total,budgets:{main:130000,total:470000}}});
}
console.log(JSON.stringify({environment:'synthetic CPU and optional local build',results},null,2));
