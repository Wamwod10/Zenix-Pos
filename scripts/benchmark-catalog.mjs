// CPU-only synthetic benchmark. Does not contact an API or database.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const optimized=process.argv.includes('--optimized');
const implementation=optimized?await import('../src/utils/posCatalogSearch.js'):null;
const queries=['','g','gu','gur','guruch','SKU-0000','99800','not-found','Choy 25'];
const legacy=(products,search,category)=>products.filter(p=>!p.archived&&(category==='all'||p.category===category)&&`${p.name} ${p.sku||''} ${p.barcode||''}`.toLowerCase().includes(search.toLowerCase()));
const percentile=(sorted,p)=>sorted[Math.ceil(sorted.length*p)-1];
for(const size of [100,1000,10000,50000]){
 const products=Array.from({length:size},(_,i)=>({id:String(i),name:`${i%2?'Guruch':'Choy'} ${i} qadoq 25 kg`,sku:`SKU-${String(i).padStart(6,'0')}`,barcode:`998${String(i).padStart(10,'0')}`,category:i%3?'Food':'Drink',archived:i%19===0}));
 const setup=performance.now();
 const index=optimized?implementation.createPosCatalogSearch(products):null;
 const setupMs=performance.now()-setup;
 const run=(q,c)=>optimized?implementation.searchPosCatalog(index,q,c):legacy(products,q,c);
 for(const q of queries)for(const c of ['all','Food'])assert.deepEqual(run(q,c),legacy(products,q,c));
 for(let i=0;i<30;i++)run(queries[i%queries.length],'all');
 const samples=[];let matches=0;
 for(let i=0;i<270;i++){const start=performance.now();matches+=run(queries[i%queries.length],i%3?'all':'Food').length;samples.push(performance.now()-start)}
 samples.sort((a,b)=>a-b);
 console.log(JSON.stringify({mode:optimized?'indexed':'baseline',size,samples:samples.length,setupMs,p50:percentile(samples,.5),p95:percentile(samples,.95),p99:percentile(samples,.99),matches}));
}
