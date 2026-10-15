// Synthetic cart reconciliation CPU benchmark; no API or database access.
import {reconcilePersistedCart} from '../src/utils/posCartReconciliation.js';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
const indexed=process.argv.includes('--optimized');
const legacy=indexed?null:(await import(`data:text/javascript;base64,${Buffer.from(execFileSync(process.env.GIT_EXECUTABLE||'git',['-c',`safe.directory=${process.cwd()}`,'show','6b69a9f03bfecabb02a02c586a5d45fe5494c0a2:src/utils/posCartReconciliation.js'],{encoding:'utf8'})).toString('base64')}`)).reconcilePersistedCart;
for(const size of [100,1000,10000,50000]){
 const products=Array.from({length:size},(_,i)=>({id:String(i),name:`Test ${i}`,sellPrice:12500,stockByStore:{test:100}}));
 const lines=products.slice(-10).map(p=>({...p,cartQty:1}));
 const catalog=indexed?new Map(products.map(p=>[p.id,p])):products;
 const run=()=>(indexed?reconcilePersistedCart:legacy)({lines,products:catalog,storeId:'test'});
 for(let i=0;i<10;i++)run();
 const samples=[];
 for(let i=0;i<100;i++){const start=performance.now();const result=run();if(result.lines.length!==10)throw new Error('Cart changed');samples.push(performance.now()-start)}
 samples.sort((a,b)=>a-b);
 console.log(JSON.stringify({mode:indexed?'indexed':'baseline',size,cartLines:10,samples:100,p50:samples[49],p95:samples[94],p99:samples[98]}));
}
