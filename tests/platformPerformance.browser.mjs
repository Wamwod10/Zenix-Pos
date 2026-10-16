// Production local-only synthetic audit. Every nonlocal request is blocked.
import {chromium} from 'playwright-core';
import {build,preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve(process.env.ZENIX_PLATFORM_ARTIFACTS||'../artifacts/performance-continuation-20261016');
await mkdir(output,{recursive:true});
const outDir=path.join(output,'platform-build');
await build({build:{outDir,emptyOutDir:true},logLevel:'error'});
const vite=await preview({build:{outDir},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base=`http://127.0.0.1:${vite.httpServer.address().port}`;
const store='11111111-1111-4111-8111-111111111111',results=[],errors=[],blocked=[];
const routes=['/','/sales','/customers','/products','/inventory','/suppliers','/history','/expenses','/analytics','/activity-log','/seller-analytics','/settings','/billing','/help','/profile'];
const repeats=Number(process.env.ZENIX_PLATFORM_REPEATS||10);
const summarize=values=>{const a=[...values].sort((a,b)=>a-b);return {samples:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],p99:a[Math.ceil(a.length*.99)-1],raw:values};};
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 for(const width of process.argv.includes('--profile')?[390]:[360,390,768,1366,1920]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  page.on('pageerror',e=>errors.push({width,message:e.message}));
  await page.addInitScript(()=>{
   window.__audit={longTasks:[],commits:0};
   try{new PerformanceObserver(list=>window.__audit.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true})}catch{}
   let id=0;window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,inject:()=>++id,onCommitFiberRoot:()=>window.__audit.commits++,onCommitFiberUnmount:()=>{},onPostCommitFiberRoot:()=>{}};
  });
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==base){blocked.push(url.origin);return route.abort();}
   if(!url.pathname.startsWith('/api/'))return route.continue();
   let data={users:[],sessions:[],revision:'1',holds:[]};
   if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'synthetic-org',appRole:'OWNER',name:'Test'}};
   if(url.pathname==='/api/bootstrap')data={stores:[{id:store,name:'Test'}],inventory:[],activeShifts:{[store]:{id:'shift',storeId:store,status:'open',openedAtISO:new Date().toISOString()}},organization:{id:'synthetic-org',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:1}};
   if(url.pathname==='/api/settings')data={selectedStoreId:store};
   if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
   if(url.pathname==='/api/ai/status')data={enabled:true,writable:true,writesEnabled:false,limit:1000,remaining:1000,suggestions:[]};
   if(url.pathname.endsWith('/progress'))data={phase:'reading_inventory'};
   if(url.pathname==='/api/ai/chat'){await new Promise(r=>setTimeout(r,500));data={conversationId:'33333333-3333-4333-8333-333333333333',answer:'Synthetic measured answer.',actions:[],insights:[]};}
   await route.fulfill({json:{ok:true,data}});
  });
  const cdp=await page.context().newCDPSession(page),mobile=width<768;
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:mobile?4:1});
  if(mobile)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:100000});
  await cdp.send('Performance.enable');
  await page.goto(base+'/sales');await page.locator('.zenix-ai-trigger').waitFor();
  const initial=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation')[0].toJSON(),paint:performance.getEntriesByType('paint').map(e=>e.toJSON()),interactiveShellObserved:performance.now(),commits:window.__audit.commits}));
  const navigation=[];
  for(const route of routes){
   const observation=await page.evaluate(async route=>{
    const before=window.__audit.commits,start=performance.now(),main=document.querySelector('main.content');
    const committed=new Promise(resolve=>{const observer=new MutationObserver(()=>{observer.disconnect();resolve(performance.now()-start)});observer.observe(main||document.body,{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve(null)},10000)});
    history.pushState({},'',route);dispatchEvent(new PopStateEvent('popstate'));
    const firstDOMMutationMs=await committed;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return {route,firstDOMMutationMs,twoRafAfterMutationMs:performance.now()-start,commits:window.__audit.commits-before};
   },route);
   await page.locator('main.content').waitFor();await page.waitForTimeout(150);
   observation.heading=(await page.locator('main.content').innerText()).slice(0,120);navigation.push(observation);
  }
  const launcher=[],sending=[],reply=[],launcherFrames=[];
  if(process.argv.includes('--profile')){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReturnAsStream'});}
  for(let i=0;i<repeats;i++){
   const opened=await page.evaluate(async()=>{
    performance.mark('audit-launch-start');const start=performance.now();document.querySelector('.zenix-ai-trigger').click();
    await new Promise(resolve=>{const poll=()=>document.querySelector('#zenix-ai-question')&&!document.querySelector('#zenix-ai-panel').hidden?resolve():setTimeout(poll,0);poll()});
    const dom=performance.now()-start;performance.mark('audit-launch-dom');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {dom,frame:performance.now()-start};
   });launcher.push(opened.dom);launcherFrames.push(opened.frame);
   await page.locator('#zenix-ai-question').fill(`Synthetic audit ${i}`);
   const measured=await page.evaluate(async()=>{
    const input=document.querySelector('#zenix-ai-question'),count=document.querySelectorAll('.zenix-ai-answer').length,start=performance.now();
    performance.mark('audit-send-start');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
    const waitFor=predicate=>new Promise((resolve,reject)=>{const poll=()=>{if(predicate())return resolve(performance.now()-start);if(performance.now()-start>10000)return reject(Error('AI state timeout'));setTimeout(poll,0)};poll()});
    const feedback=await waitFor(()=>document.querySelector('.zenix-ai-thinking'));performance.mark('audit-send-feedback');
    const answer=await waitFor(()=>document.querySelectorAll('.zenix-ai-answer').length>count);return {feedback,answer};
   });sending.push(measured.feedback);reply.push(measured.answer);
   await page.getByRole('button',{name:'AI panelini yopish',exact:true}).click();
  }
  if(process.argv.includes('--profile')){
   const {profile}=await cdp.send('Profiler.stop');await writeFile(path.join(output,'ai-mobile.cpuprofile'),JSON.stringify(profile));
   const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await complete;
   let trace='';while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}await cdp.send('IO.close',{handle:stream});await writeFile(path.join(output,'ai-mobile-trace.json'),trace);
  }
  const evidence=await page.evaluate(()=>({...window.__audit,memory:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize}:null}));
  const metrics=(await cdp.send('Performance.getMetrics')).metrics;
  results.push({width,cpuThrottle:mobile?4:1,network:mobile?'100ms latency; 200KB/s down;100KB/s up (local asset transport); API fulfillment synthetic':'local unthrottled',initial,navigation,ai:{launcherDOMCommitMs:summarize(launcher),launcherTwoRafMs:summarize(launcherFrames),sendingFeedbackDOMCommitMs:summarize(sending),replyDOMCommitMs:summarize(reply),mockReplyDelayMs:500},evidence,metrics});
  console.log(`Platform audit ${width}px complete`);await page.close();
 }
}finally{
 await writeFile(path.join(output,'platform-browser.json'),JSON.stringify({production:true,synthetic:true,notes:['Navigation records first main DOM mutation, which can be a skeleton; not full route readiness.','Initial timing observes client-rendered shell, not hydration; app uses createRoot.','Two requestAnimationFrame callbacks are a frame opportunity, not physical paint.','React hook counts whole-root commits; no per-component durations.','Small sample P95/P99 are descriptive order statistics, not population estimates.','All APIs mocked; no backend/OpenAI timing measured.'],results,errors,blocked},null,2));
 await writeFile(path.join(output,'platform-browser.md'),`Production Chromium synthetic audit. All APIs mocked, service workers blocked, external requests blocked. Mobile CPU 4x and local network 100ms/200KB/s down/100KB/s up. AI reply mock adds 500ms.\n\n| Width | AI launch DOM P50/P95/P99 ms | Sending feedback DOM P50/P95/P99 ms | Long tasks | Root commits |\n|---|---|---|---|---|\n`+results.map(r=>`| ${r.width} | ${['p50','p95','p99'].map(k=>r.ai.launcherDOMCommitMs[k].toFixed(1)).join('/')} | ${['p50','p95','p99'].map(k=>r.ai.sendingFeedbackDOMCommitMs[k].toFixed(1)).join('/')} | ${r.evidence.longTasks.length} | ${r.evidence.commits} |`).join('\n')+`\n\n${errors.length} runtime errors. Initial shell observation is client rendering, not hydration. Route measurements stop at the first main DOM mutation (possibly a skeleton), not complete data readiness. Two rAF callbacks are only a frame opportunity; physical paint is not measured. P95/P99 with ${repeats} samples are descriptive order statistics. Full raw measurements, route headings, navigation/paint timing and heap evidence are in platform-browser.json. Owner routes only; public authentication and platform-admin runtime flows are outside this fixture.\n`);
 await browser?.close();await new Promise(r=>vite.httpServer.close(r));
}
if(errors.length)throw Error(`Browser runtime errors: ${JSON.stringify(errors)}`);
