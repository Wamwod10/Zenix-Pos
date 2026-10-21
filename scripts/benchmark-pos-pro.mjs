import {performance} from 'node:perf_hooks';
import {mkdir,writeFile} from 'node:fs/promises';
import {addCartProduct,cartTotals} from '../src/pages/posPro/model.js';
import {createPosCatalog} from '../src/utils/posCatalog.js';
const results=[],summary=values=>{const a=values.toSorted((a,b)=>a-b);return {p50Ms:a[Math.floor(a.length*.5)],p95Ms:a[Math.ceil(a.length*.95)-1],samples:a.length}};
for(const size of [100,500]){
 const cart=Array.from({length:size},(_,i)=>({id:String(i),name:`Product ${i}`,sellPrice:12000,cartQty:1.25,quantity:1000,discountPercent:10}));
 const values=[];for(let i=0;i<100;i++){const start=performance.now();const updated=addCartProduct(cart,cart[size-1],.001);cartTotals(updated,10);values.push(performance.now()-start)}results.push({kind:'cart-update-and-money',cartSize:size,...summary(values)});
}
for(const size of [10000,50000]){
 const rows=Array.from({length:size},(_,i)=>({id:String(i),barcode:String(i).padStart(13,'0'),name:`Product ${i}`}));let maxPage=0;
 const controller=createPosCatalog({normalize:p=>p,request:async q=>{const products=q.barcode?rows.filter(p=>p.barcode===q.barcode):q.search?rows.filter(p=>p.name===q.search):rows.slice(0,40);maxPage=Math.max(maxPage,products.length);return {products,categories:[],hasMore:false}}});
 const values=[];for(let i=0;i<50;i++){const start=performance.now();await controller.search({search:`Product ${size-1}`});values.push(performance.now()-start)}results.push({kind:'catalog-controller-with-synthetic-search',catalogSize:size,maxReturnedPage:maxPage,...summary(values)});controller.dispose();
}
await mkdir('../artifacts/phase2',{recursive:true});await writeFile('../artifacts/phase2/client-benchmark.json',JSON.stringify({scope:'Node model/controller microbenchmark; no physical device or internet latency',results},null,2));console.log(JSON.stringify(results,null,2));
