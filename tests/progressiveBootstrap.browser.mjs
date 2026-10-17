// Production React app, exact previous runtime vs progressive runtime. Synthetic
// HTTP snapshots were captured from the same disposable PostgreSQL fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {build,preview} from 'vite';
import {chromium} from 'playwright-core';
const out=path.resolve('../artifacts/performance-progressive-20261017');await mkdir(out,{recursive:true});
const sizes=(process.env.ZENIX_PROGRESSIVE_SIZES||'1000,10000,50000').split(',').map(Number),widths=(process.env.ZENIX_PROGRESSIVE_WIDTHS||'390,768,1366').split(',').map(Number),n=Number(process.env.ZENIX_PROGRESSIVE_SAMPLES||10);
const direct=process.env.ZENIX_PROGRESSIVE_DIRECT==='true';
const warmups=Number(process.env.ZENIX_PROGRESSIVE_WARMUPS??2);
const baselineRef=process.env.ZENIX_PROGRESSIVE_BASELINE_REF||'6548e80';
const changed=[...(baselineRef==='6548e80'?[]:['src/context/PosWorkspace.jsx','src/utils/posCatalog.js']),'src/App.jsx','src/context/StoreContext.jsx','src/layout/MainLayout.jsx','src/pages/sales/Sales.jsx','src/pages/dashboard/Dashboard.jsx','src/pages/ai/ZenixAI.jsx'];
const servers=[],bases={},samples=[],errors=[],external=[];
for(const mode of ['before','after']){
 const plugin={name:'previous-runtime',enforce:'pre',load(id){const file=id.split('?')[0].replaceAll('\\','/');const relative=changed.find(p=>file===path.resolve(p).replaceAll('\\','/'));if(process.env.ZENIX_PROGRESSIVE_DIAG==='true'&&mode==='after'&&file.endsWith('/src/context/PosWorkspace.jsx'))return readFileSync(file,'utf8').replace('Promise.all([controller.search({}),controller.resolve(ids)])',"(performance.mark('catalog-start'),Promise.all([controller.search({}),controller.resolve(ids)]))").replace('if(current)setReady(true)',"if(current){performance.mark('catalog-ready');setReady(true)}");if(process.env.ZENIX_PROGRESSIVE_DIAG==='true'&&mode==='after'&&file.endsWith('/src/pages/sales/Sales.jsx'))return readFileSync(file,'utf8').replace('function Sales(){',"function Sales(){performance.mark('sales-render');");if(mode==='before'&&relative)return execFileSync(process.env.GIT_EXECUTABLE||'C:/Program Files/Git/cmd/git.exe',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'show',`${baselineRef}:${relative}`],{encoding:'utf8'})}};
 const outDir=path.join(out,'browser-'+mode);await build({plugins:[plugin],define:{'import.meta.env.VITE_API_URL':JSON.stringify('')},build:{outDir,emptyOutDir:true},logLevel:'error'});
 const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:0},logLevel:'error'});servers.push(server);bases[mode]=`http://127.0.0.1:${server.httpServer.address().port}`;
}
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try{
 for(const size of sizes){
  const legacy=JSON.parse(await readFile(path.join(out,`bootstrap-${size}-legacy.json`),'utf8')),core=JSON.parse(await readFile(path.join(out,`bootstrap-${size}-core.json`),'utf8'));
  const inventory=legacy.data.inventory,store=legacy.data.stores[0].id,unloaded=inventory[0],byId=new Map(inventory.map(p=>[p.id,p]));
  // Bootstrap is created_at ascending; the remote page is descending. Never
  // call an already-loaded newest product an unloaded-product test.
  const descending=[...inventory].reverse();
  for(const width of widths)for(let iteration=-warmups;iteration<n;iteration++)for(const mode of iteration%2?['after','before']:['before','after']){
   const base=bases[mode],page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});let responseBytes=0,catalogRequests=0;
   page.on('pageerror',e=>errors.push({mode,size,width,message:e.message}));
   await page.addInitScript(()=>{window.__perf={parse:[],long:[]};new MutationObserver(()=>{if(!window.__perf.firstProduct&&document.querySelector('.pos-product'))window.__perf.firstProduct=performance.now()}).observe(document,{childList:true,subtree:true});new PerformanceObserver(list=>window.__perf.long.push(...list.getEntries().map(t=>t.duration))).observe({type:'longtask',buffered:true});const original=Response.prototype.json;Response.prototype.json=async function(){if(!this.url.includes('/api/bootstrap'))return original.call(this);const text=await this.text(),start=performance.now(),value=JSON.parse(text);window.__perf.parse.push(performance.now()-start);return value}});
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin!==base){external.push(url.origin);return route.abort()}
    if(!url.pathname.startsWith('/api/'))return route.continue();let data={users:[],holds:[],revision:'1',items:[]};
    if(url.pathname==='/api/bootstrap')data=(request.headers()['x-zenix-bootstrap']==='core'?core:legacy).data;
    else if(url.pathname==='/api/bootstrap/catalog'){
     catalogRequests++;const q=url.searchParams,ids=q.get('ids')?.split(','),needle=(q.get('search')||'').toLowerCase(),category=q.get('category');let rows=ids?ids.map(id=>byId.get(id)).filter(Boolean):descending.filter(p=>!p.archived&&(!needle||`${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(needle))&&(!category||p.category===category)&&(!q.get('barcode')||p.barcode===q.get('barcode')));
     const offset=Number(q.get('cursor')||0),limit=Number(q.get('limit')||50),more=!ids&&rows.length>offset+limit;rows=ids?rows:rows.slice(offset,offset+limit);
     data={products:rows.map(p=>({...p,stockByStore:{[store]:p.stockByStore[store]??0}})),hasMore:more,nextCursor:more?String(offset+limit):null,categories:[...new Set(inventory.filter(p=>!p.archived).map(p=>p.category).filter(Boolean))],...(ids?{missingIds:ids.filter(id=>!byId.has(id))}:{})};
    }else if(url.pathname==='/api/auth/me')data={user:{id:'synthetic-owner',organizationId:legacy.data.organization.id,appRole:'OWNER',name:'Synthetic'}};
    else if(url.pathname==='/api/settings')data={selectedStoreId:store};
    else if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
    else if(url.pathname==='/api/ai/status')data={enabled:false};
    const body=JSON.stringify({ok:true,data});responseBytes+=Buffer.byteLength(body);await route.fulfill({contentType:'application/json',body});
   });
   const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:width===390?4:1});let heap=0,polling=true;
   const poll=(async()=>{while(polling){try{const m=await cdp.send('Performance.getMetrics');heap=Math.max(heap,m.metrics.find(x=>x.name==='JSHeapUsedSize')?.value||0)}catch{}await new Promise(r=>setTimeout(r,250))}})();
   await page.goto(base+(direct?'/sales':'/'));let dashboard=null;
   if(!direct){
    await page.locator('.dashboard-pro .pro-stat').first().waitFor();await page.locator('.dashboard-pro .pro-alert[role="status"]').waitFor({state:'hidden'});dashboard=await page.evaluate(()=>performance.now());
    if(mode==='after')assert.ok((await page.locator('.dashboard-pro').innerText()).includes('Qoldiq hali yuklanmagan'));
    // Navigate through the real router, retaining the app shell.
    await page.evaluate(()=>{window.__posStart=performance.now();document.querySelector('a[href="/sales"]').click()});
   }else await page.evaluate(()=>{window.__posStart=0});
   await page.locator('.pos-product').first().waitFor({timeout:60000});
   const usable=await page.evaluate(()=>({navigationMs:performance.now()-window.__posStart,posUsableMs:performance.now(),...window.__perf,marks:performance.getEntriesByType('mark').map(e=>({name:e.name,start:e.startTime})),resources:performance.getEntriesByType('resource').filter(e=>/Sales|catalog/.test(e.name)).map(e=>({name:e.name,start:e.startTime,end:e.responseEnd})),paint:performance.getEntriesByType('paint').map(p=>({name:p.name,start:p.startTime}))}));
   if(process.env.ZENIX_PROGRESSIVE_DIAG==='true')console.log(JSON.stringify({diagnostic:true,mode,usable}));
   if(mode==='after'){assert.equal(catalogRequests,1);assert.equal(await page.locator('.pos-product').filter({hasText:unloaded.name}).count(),0)}
   const searchStart=performance.now();await page.locator('.pos-search input').fill(unloaded.sku);await page.locator('.pos-product').filter({hasText:unloaded.name}).first().waitFor();const searchMs=performance.now()-searchStart;await page.locator('.pos-product').filter({hasText:unloaded.name}).first().click();assert.equal(await page.locator('.cart-item').count(),1);
   polling=false;await poll;
   if(iteration>=0){const row={size,width,mode,iteration,dashboardMs:dashboard,posUsableMs:usable.posUsableMs,navigationMs:usable.navigationMs,parseTotalMs:usable.parse.reduce((a,b)=>a+b,0),parseMaxMs:Math.max(0,...usable.parse),longMaxMs:Math.max(0,...usable.long),longTotalMs:usable.long.reduce((a,b)=>a+b,0),blockingMs:usable.long.reduce((a,b)=>a+Math.max(0,b-50),0),heapObservedMax:heap,responseBytes,searchMs,fcpMs:usable.paint.find(p=>p.name==='first-contentful-paint')?.start};samples.push(row);console.log(JSON.stringify(row))}
   await page.close();
  }
 }
}finally{
 await browser.close();for(const s of servers)await new Promise(r=>s.httpServer.close(r));
 const percentile=(a,p)=>a.toSorted((a,b)=>a-b)[Math.ceil(a.length*p)-1];const groups=[];
 for(const size of sizes)for(const width of widths)for(const mode of ['before','after']){const rows=samples.filter(r=>r.size===size&&r.width===width&&r.mode===mode);if(rows.length)groups.push({size,width,mode,n:rows.length,...Object.fromEntries(['dashboardMs','posUsableMs','navigationMs','parseTotalMs','parseMaxMs','longMaxMs','longTotalMs','blockingMs','heapObservedMax','responseBytes','searchMs','fcpMs'].map(k=>[k,Object.fromEntries([['p50',.5],['p95',.95],['p99',.99]].map(([label,p])=>[label,percentile(rows.map(r=>r[k]),p)]))]))})}
 await writeFile(path.join(out,process.env.ZENIX_PROGRESSIVE_OUTPUT|| (process.env.ZENIX_PROGRESSIVE_DIAG==='true'?'browser-results-diag.json':direct?'browser-results-direct.json':'browser-results-journey.json')),JSON.stringify({direct,baselineRef,warmups,note:'Actual React app, before baselineRef modified runtime files; captured disposable HTTP data, intercepted APIs (no actual network latency); equal explicit JSON parser instrumentation. Configured warmups then alternating cohorts; mobile4xCPU, tablet/desktop1x; sampled main JS heap250ms not OS peak. Small-n P95/P99 are observations, not guarantees. Direct run dashboard=null and navigation=full cold POS document-to-usable; journey navigation=router click-to-usable.',groups,samples,errors,external},null,2));
}
assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(external.length,0,JSON.stringify(external));
