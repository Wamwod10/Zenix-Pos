// Complete local app, synthetic API snapshots captured from disposable PostgreSQL.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build,preview} from 'vite';
import {chromium} from 'playwright-core';
const output=path.resolve('../artifacts/performance-final-20261016');await mkdir(output,{recursive:true});
const original=await readFile(path.join(output,'bootstrap-fixture-legacy.json'),'utf8');
const fixture={legacy:original,cooperative:original};
const canonical=JSON.parse(fixture.legacy).data,store=canonical.stores[0].id;
assert.equal(canonical.inventory.length,50000);
const results=[],errors=[],servers=[];
const summarize=values=>{const a=[...values].sort((a,b)=>a-b);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],p99:a.at(-1)}};
const count=Number(process.env.ZENIX_BOOTSTRAP_BROWSER_SAMPLES||12);
const bases={};
for(const mode of ['legacy','cooperative']){
 const plugin={name:'bootstrap-observer-'+mode,enforce:'pre',transform(source,id){
  if(mode==='legacy'&&id.replaceAll('\\','/').endsWith('/src/services/apiClient.js'))return execFileSync(process.env.GIT_EXECUTABLE||'git',['-c',`safe.directory=${process.cwd()}`,'show','c3123ba768983dda735f227c930d80f2fcaac4d5:src/services/apiClient.js'],{encoding:'utf8'});
  if(!id.replaceAll('\\','/').endsWith('/src/context/StoreContext.jsx'))return;
  if(mode==='legacy')source=execFileSync(process.env.GIT_EXECUTABLE||'git',['-c',`safe.directory=${process.cwd()}`,'show','c3123ba768983dda735f227c930d80f2fcaac4d5:src/context/StoreContext.jsx'],{encoding:'utf8'});
  if(mode==='legacy')source=source.replace('setInventoryState((base.inventory||[]).map((item)=>productFromApi(item,storeIds)));','{const start=performance.now();setInventoryState((base.inventory||[]).map((item)=>productFromApi(item,storeIds)));window.__boot.normalizeMs=performance.now()-start;}');
  else source=source.replace('const nextInventory=await mapBootstrapInventory','const normalizationStart=performance.now();const nextInventory=await mapBootstrapInventory').replace('productFromApi(item,storeIds),{isCurrent});','productFromApi(item,storeIds),{isCurrent,onChunk:ms=>window.__boot.chunks.push(ms)});').replace('if(!nextInventory||!isCurrent())return;','if(!nextInventory||!isCurrent())return;window.__boot.normalizeMs=performance.now()-normalizationStart;');
  source=source.replace('return <StoreContext.Provider value={value}>','if(workspaceReady&&currentUser?.organizationId&&!window.__boot.ready){window.__boot.ready=performance.now();window.__boot.inventoryCount=inventoryState.length;}return <StoreContext.Provider value={value}>');
  return source;
 }};
 const outDir=path.join(output,'bootstrap-browser-'+mode);await build({plugins:[plugin],build:{outDir,emptyOutDir:true},logLevel:'error'});
 const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:0},logLevel:'error'});servers.push(server);bases[mode]=`http://127.0.0.1:${server.httpServer.address().port}`;
}
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 for(const width of [1366,390])for(let i=0;i<count+2;i++)for(const mode of i%2?['cooperative','legacy']:['legacy','cooperative']){
  const base=bases[mode],page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__boot={longTasks:[],normalizeMs:null,chunks:[]};
   new PerformanceObserver(list=>window.__boot.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
   // Identical explicit parser in both cohorts separates text/JSON cost. This is instrumentation, not production parsing code.
   const original=Response.prototype.json;Response.prototype.json=async function(){if(!this.url.includes('/api/bootstrap'))return original.call(this);const text=await this.text(),start=performance.now();const result=JSON.parse(text);window.__boot.parseMs=performance.now()-start;return result;};
  });
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
   if(url.pathname==='/api/bootstrap')return route.fulfill({contentType:'application/json',body:fixture[mode]});
   let data={users:[],holds:[],revision:'1',items:[]};
   if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:canonical.organization.id,appRole:'OWNER',name:'Synthetic'}};
   if(url.pathname==='/api/settings')data={selectedStoreId:store};
   if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
   if(url.pathname==='/api/ai/status')data={enabled:false};
   await route.fulfill({json:{ok:true,data}});
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:width===390?4:1});
  let peakHeap=0,polling=true;
  const poll=(async()=>{while(polling){try{const m=await cdp.send('Performance.getMetrics');peakHeap=Math.max(peakHeap,m.metrics.find(m=>m.name==='JSHeapUsedSize')?.value||0)}catch{}await new Promise(r=>setTimeout(r,250))}})();
  await page.goto(base+'/sales');await page.locator('.pos-product').first().waitFor({timeout:60000});
  const measured=await page.evaluate(()=>({...window.__boot,usableMs:performance.now()}));
  assert.equal(measured.inventoryCount,50000);assert.ok(measured.normalizeMs!==null);
  // Last item remains searchable and can be added; no truncation masquerades as speed.
  await page.locator('.pos-search input').fill(canonical.inventory.at(-1).sku);await page.locator('.pos-product').filter({hasText:canonical.inventory.at(-1).name}).first().click();
  assert.equal(await page.locator('.cart-item').count(),1);
  polling=false;await poll;
  if(i>=2){const row={width,mode,iteration:i-2,usableMs:measured.usableMs,readyMs:measured.ready,parseMs:measured.parseMs,normalizeMs:measured.normalizeMs,normalizationMaxChunkMs:mode==='legacy'?measured.normalizeMs:Math.max(...measured.chunks),peakHeapBytes:peakHeap,maxLongTaskMs:Math.max(0,...measured.longTasks.map(t=>t.duration)),longTaskTotalMs:measured.longTasks.reduce((n,t)=>n+t.duration,0)};results.push(row);console.log(JSON.stringify(row));}
  await page.close();
 }
}finally{
 await browser?.close();for(const server of servers)await new Promise(resolve=>server.httpServer.close(resolve));
 const groups=[];for(const width of [1366,390])for(const mode of ['legacy','cooperative']){const rows=results.filter(r=>r.width===width&&r.mode===mode);if(rows.length)groups.push({width,mode,...Object.fromEntries(['usableMs','readyMs','parseMs','normalizeMs','normalizationMaxChunkMs','peakHeapBytes','maxLongTaskMs','longTaskTotalMs'].map(key=>[key,summarize(rows.map(r=>r[key]))]))});}
 await writeFile(path.join(output,'bootstrap-cooperative-browser.json'),JSON.stringify({environment:'Actual production React app; previous StoreContext versus current; alternating cohorts, identical full synthetic50k JSON; 1366px1x/390px4x; API intercepted, not network latency; explicit equal JSON parser instrumentation; 250ms sampled main JS heap is observed maximum, not whole-browser peak RSS',groups,results,errors},null,2));
}
assert.equal(errors.length,0,JSON.stringify(errors));
