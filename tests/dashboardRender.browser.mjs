// Local production profiling renderer, synthetic API fixtures only.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {build,preview} from 'vite';
import react from '@vitejs/plugin-react';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('../artifacts/performance-continuation-20261016');
await mkdir(output,{recursive:true});
const outDir=path.join(output,'dashboard-profile-build');
const instrumentation={name:'synthetic-dashboard-profiler',enforce:'pre',transform(source,id){
  const name=id.endsWith('/dashboard/Dashboard.jsx')?'Dashboard':id.endsWith('/analytics/Analytics.jsx')?'Analytics':null;
  const prefix='import {Profiler as AuditProfiler} from "react";\n';
  const callback='(id,phase,actualDuration,baseDuration,startTime,commitTime)=>window.__renderAudit.samples.push({id,phase,actualDuration,baseDuration,startTime,commitTime})';
  if(name){
    source=source.replace(new RegExp(`function ${name}\\(\\)\\s*\\{`),`function ${name}(){window.__renderAudit.calls.${name}++;`);
    return prefix+source.replace(`export default ${name};`,`export default function Audit${name}(){return <AuditProfiler id="${name}" onRender={${callback}}><${name}/></AuditProfiler>}`);
  }
  if(id.endsWith('/components/ResponsiveChart.jsx'))return prefix+source.replace('return <ResponsiveContainer',`window.__renderAudit.chartCalls++;return <AuditProfiler id={location.pathname+':chart'} onRender={${callback}}><ResponsiveContainer`).replace('</ResponsiveContainer>;','</ResponsiveContainer></AuditProfiler>;');
}};
await build({configFile:false,plugins:[instrumentation,react()],resolve:{alias:[{find:/^react-dom\/client$/,replacement:path.resolve('node_modules/react-dom/profiling.js')}]},define:{'import.meta.env.VITE_API_URL':'""'},build:{outDir,emptyOutDir:true},logLevel:'error'});
const vite=await preview({configFile:false,build:{outDir},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base=`http://127.0.0.1:${vite.httpServer.address().port}`;
const store='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
const results=[],errors=[],blocked=[];
let browser;
const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,p50:sorted[Math.ceil(values.length*.5)-1]??null,p95:sorted[Math.ceil(values.length*.95)-1]??null,total:values.reduce((a,b)=>a+b,0)};};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 for(const size of [1000,10000]){
  const products=Array.from({length:size},(_,i)=>({id:`p${i}`,name:`Product ${i}`,category:i%2?'Food':'Drink',costPrice:50,sellPrice:100,quantity:20,stockByStore:{[store]:10,[second]:10}}));
  const sales=Array.from({length:size},(_,i)=>{const day=new Date();day.setUTCDate(day.getUTCDate()-i%60);const dateISO=day.toISOString().slice(0,10);return {id:`sale${i}`,storeId:i%2?store:second,businessDateISO:dateISO,dateISO,time:'12:00',sellerId:`seller${i%4}`,sellerName:`Seller ${i%4}`,payment:'cash',paymentMethod:'cash',total:200,paidAmount:200,items:[{productId:`p${i}`,name:`Product ${i}`,category:i%2?'Food':'Drink',quantity:2,price:100,costPrice:50,returnedQty:0}]};});
  const expenses=Array.from({length:100},(_,i)=>({id:`expense${i}`,dateISO:sales[i].dateISO,storeId:store,amount:25,category:'Rent'}));
  const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  page.on('pageerror',error=>errors.push({size,message:error.message}));
  await page.addInitScript(()=>{window.__renderAudit={samples:[],calls:{Dashboard:0,Analytics:0},chartCalls:0};});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==base){blocked.push(url.origin);return route.abort();}
   if(!url.pathname.startsWith('/api/'))return route.continue();
   let data={users:[],sessions:[],revision:'1'};
   if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'synthetic-org',appRole:'OWNER',name:'Test'}};
   if(url.pathname==='/api/bootstrap')data={stores:[{id:store,name:'Main'},{id:second,name:'Other'}],inventory:products,suppliers:[],returns:[],organization:{id:'synthetic-org',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:2}};
   if(url.pathname==='/api/settings')data={selectedStoreId:store,organization:{timezone:'Asia/Tashkent'},businessDay:{startTime:'04:00'}};
   if(url.pathname==='/api/finance'){
    const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'9999',branch=url.searchParams.get('storeId'),seller=url.searchParams.get('sellerId');
    const selected=sales.filter(s=>s.dateISO>=from&&s.dateISO<=to&&(!branch||s.storeId===branch)&&(!seller||s.sellerId===seller));
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||500);
    data={sales:selected.slice(offset,offset+limit),returns:[],expenses:offset?[]:expenses.filter(e=>e.dateISO>=from&&e.dateISO<=to&&(!branch||e.storeId===branch)),pagination:{total:selected.length,returnTotal:0,hasMore:offset+limit<selected.length,offset,limit}};
   }
   if(url.pathname==='/api/ai/status')data={enabled:false};
   await route.fulfill({json:{ok:true,data}});
  });
  for(const [route,name] of [['/','Dashboard'],['/analytics','Analytics']]){
   await page.goto(base+route);await page.locator(name==='Dashboard'?'.dashboard-pro':'.analytics-pro').waitFor();
   const settled=async()=>{await page.waitForFunction(()=>!document.querySelector('.dashboard-pro > [role="status"],.analytics-pro > [role="status"]'));await page.waitForTimeout(600);};
   await settled();
   assert.ok((await page.evaluate(()=>window.__renderAudit.samples)).some(s=>s.id===name),'profiling renderer must emit actual page subtree durations');
   const initial=await page.evaluate(()=>structuredClone(window.__renderAudit));
   const observations=[];
   for(let i=0;i<8;i++){
    const before=await page.evaluate(()=>({sample:window.__renderAudit.samples.length,calls:{...window.__renderAudit.calls},chartCalls:window.__renderAudit.chartCalls}));
    const start=Date.now();
    if(name==='Analytics')await page.getByRole('button',{name:i%2?'30 kun':'7 kun',exact:true}).click();
    else {
      const trigger=page.locator('.dashboard-filters .premium-select').first();
      await trigger.click();await page.getByRole('option',{name:i%2?'7 kun':'30 kun',exact:true}).click();
    }
    await settled();
    const after=await page.evaluate(()=>structuredClone(window.__renderAudit));
    const samples=after.samples.slice(before.sample);
    observations.push({iteration:i,includingSettlementWaitMs:Date.now()-start,pageRenderCalls:after.calls[name]-before.calls[name],chartRenderCalls:after.chartCalls-before.chartCalls,pageCommits:samples.filter(s=>s.id===name),chartCommits:samples.filter(s=>s.id.endsWith(':chart'))});
   }
   results.push({size,name,initial,observations,pageDuration:summary(observations.flatMap(o=>o.pageCommits.map(s=>s.actualDuration))),pageRenderCalls:observations.map(o=>o.pageRenderCalls),chartRenderCalls:observations.map(o=>o.chartRenderCalls)});
   console.log(`${name} ${size}: ${JSON.stringify(results.at(-1).pageDuration)}`);
  }
  await page.close();
 }
}finally{
 await writeFile(path.join(output,'dashboard-render-results.json'),JSON.stringify({renderer:'React production profiling',viewport:1366,cpuThrottle:1,synthetic:true,results,errors,blocked},null,2));
 await writeFile(path.join(output,'dashboard-render-results.md'),'# Dashboard / Analytics component profiles\n\nLocal Chromium, React production profiling renderer, 1366px, CPU 1x. Synthetic two-branch sale/product fixtures; 100 expenses, one item per sale with quantity 2, four sellers; paginated mocked finance API. All external requests and service workers blocked. Eight alternating period selections per page/size after initial loading; chart animations/resize settling included in subtree callbacks.\n\n| Page | Sales/products fixture | Page render calls per selection | Page subtree commit actualDuration P50/P95 ms | Chart render calls per selection |\n|---|---|---|---|---|\n'+results.map(r=>`| ${r.name} | ${r.size} | ${r.pageRenderCalls.join(',')} | ${r.pageDuration.p50?.toFixed(2)}/${r.pageDuration.p95?.toFixed(2)} | ${r.chartRenderCalls.join(',')} |`).join('\n')+'\n\nRender calls are instrumented function entries of Dashboard/Analytics and ResponsiveChart, rather than whole-root commit counts. Profiler actualDuration measures the page subtree including descendants, not exclusive page-function CPU or physical paint. Chart durations are separate overlapping subtree observations and must not be summed with page durations. Production profiling adds overhead. No before/after browser speedup claim; this profiles current code only. Synthetic finance responses filter branch/date/seller and paginate but do not certify backend aggregates, production API or financial correctness. Raw per-commit and initial-load observations are retained in JSON. Interaction wall times contain an explicit 600ms settle wait and are not latency claims.\n'+`\nRuntime errors: ${errors.length}; blocked external origins: ${[...new Set(blocked)].join(',')||'none'}.\n`);
 await browser?.close();await new Promise(resolve=>vite.httpServer.close(resolve));
}
assert.equal(errors.length,0,JSON.stringify(errors));
