import {chromium} from 'playwright-core';
import {build,preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const label=process.argv[2]||'diagnostic', output=path.resolve(process.env.ZENIX_AI_TAIL_ARTIFACTS||'../artifacts/performance-continuation-20261016/ai-interaction-tails');
const widths=process.env.ZENIX_AI_WIDTHS?process.env.ZENIX_AI_WIDTHS.split(',').map(Number):[390,1366];
if(!widths.length||widths.some(width=>!Number.isInteger(width)||width<320))throw Error('ZENIX_AI_WIDTHS must contain comma-separated viewport widths of at least 320px');
const baselineRef='c3123ba', baselineFile=path.resolve('src/pages/ai/ZenixAI.jsx').replaceAll('\\','/');
const baselineSource=label==='before'?execFileSync('C:/Program Files/Git/cmd/git.exe',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'show',`${baselineRef}:src/pages/ai/ZenixAI.jsx`],{encoding:'utf8'}):null;
// Override only this component in the build; never rewrite the working tree.
const baselinePlugin={name:'ai-exact-baseline',enforce:'pre',load(id){if(baselineSource!==null&&id.split('?')[0].replaceAll('\\','/')===baselineFile)return baselineSource}};
await mkdir(output,{recursive:true});
const outDir=path.join(output,`build-${label}`);
await build({plugins:[baselinePlugin],build:{outDir,emptyOutDir:true},logLevel:'error'});
const vite=await preview({build:{outDir},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base=`http://127.0.0.1:${vite.httpServer.address().port}`,store='11111111-1111-4111-8111-111111111111',results=[],errors=[],blocked=[];
const repeats=Number(process.env.ZENIX_AI_TAIL_REPEATS||20);
const summary=values=>{const a=[...values].sort((a,b)=>a-b);return {samples:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],p99:a[Math.ceil(a.length*.99)-1],raw:values}};
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__audit={longTasks:[],commits:0};new PerformanceObserver(list=>window.__audit.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});let id=0;window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,inject:()=>++id,onCommitFiberRoot:()=>window.__audit.commits++,onCommitFiberUnmount:()=>{},onPostCommitFiberRoot:()=>{}}});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==base){blocked.push(url.origin);return route.abort()}if(!url.pathname.startsWith('/api/'))return route.continue();
   let data={users:[],sessions:[],revision:'1',holds:[]};
   if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'synthetic-org',appRole:'OWNER',name:'Test'}};
   if(url.pathname==='/api/bootstrap')data={stores:[{id:store,name:'Test'}],inventory:[],organization:{id:'synthetic-org',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:1}};
   if(url.pathname==='/api/settings')data={selectedStoreId:store};
   if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
   if(url.pathname==='/api/ai/status')data={enabled:true,writable:true,writesEnabled:true,limit:1000,remaining:1000,suggestions:[]};
   if(url.pathname.endsWith('/progress'))data={phase:'reading_inventory'};
   if(url.pathname==='/api/ai/chat'){
    await new Promise(r=>setTimeout(r,350));
    data={conversationId:'33333333-3333-4333-8333-333333333333',answer:'Synthetic long answer.\n'.repeat(60),blocks:Array.from({length:10},(_,i)=>({type:'facts',text:`Group ${i}`,facts:Array.from({length:10},(_,j)=>({id:`${i}-${j}`,text:`Synthetic fact ${j}`}))})),report:{facts:[],tables:[{title:'Synthetic report',columns:['Product','Quantity','Value'],rows:Array.from({length:50},(_,i)=>[`Item ${i}`,i,`${i}.00`])}]},insights:[],actions:[]};
    if(route.request().postDataJSON().question==='pending')data.actions=[{id:'synthetic-pending',type:'stock_receipt',status:'PENDING',expiresAt:new Date(Date.now()+600000).toISOString(),confirmationToken:'synthetic-only',preview:{productName:'Synthetic item',quantity:1,costPrice:1}}];
   }
   await route.fulfill({json:{ok:true,data}});
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:width<768?4:1});
  await page.goto(base+'/sales');await page.locator('.zenix-ai-trigger').waitFor();
  const measure=async(action,selector)=>page.evaluate(async({action,selector})=>{const start=performance.now(),before=window.__audit.commits; if(action==='launch')document.querySelector('.zenix-ai-trigger').click();else document.querySelector(action).click();while(!document.querySelector(selector))await new Promise(r=>setTimeout(r,0));const dom=performance.now()-start;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {dom,twoRaf:performance.now()-start,commits:window.__audit.commits-before}}, {action,selector});
  const launch=await measure('launch','#zenix-ai-question');await page.locator('#zenix-ai-question').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#zenix-ai-question').disabled);
  const cohorts=[];
  for(const history of [0,10,19]){
   while(await page.locator('.zenix-ai-answer').count()<history){await page.locator('#zenix-ai-question').fill('long');await page.locator('.zenix-ai-compose').evaluate(form=>form.requestSubmit());await page.waitForFunction(()=>!document.querySelector('#zenix-ai-question').disabled)}
   const typing=[];
   for(let i=0;i<repeats;i++){
    const value=`Draft ${i}`;
    typing.push(await page.evaluate(async value=>{const input=document.querySelector('#zenix-ai-question'),start=performance.now(),before=window.__audit.commits;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));while(document.querySelector('.zenix-ai-compose button').disabled)await new Promise(r=>setTimeout(r,0));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {twoRaf:performance.now()-start,commits:window.__audit.commits-before}},value));
   }
   cohorts.push({history,inputTwoRafMs:summary(typing.map(x=>x.twoRaf)),commits:typing.map(x=>x.commits)});
  }
  const sends=[];for(let i=0;i<repeats;i++){await page.locator('#zenix-ai-question').fill(i===repeats-1?'pending':`send ${i}`);
  sends.push(await page.evaluate(async()=>{const start=performance.now(),count=document.querySelectorAll('.zenix-ai-answer').length;document.querySelector('.zenix-ai-compose').requestSubmit();while(!document.querySelector('.zenix-ai-thinking'))await new Promise(r=>setTimeout(r,0));const feedback=performance.now()-start;while(document.querySelector('#zenix-ai-question').disabled)await new Promise(r=>setTimeout(r,0));const reply=performance.now()-start;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {feedbackDOM:feedback,replyDOM:reply,replyTwoRaf:performance.now()-start}}));}
  const send={feedbackDOM:summary(sends.map(x=>x.feedbackDOM)),replyDOM:summary(sends.map(x=>x.replyDOM)),replyTwoRaf:summary(sends.map(x=>x.replyTwoRaf))};
  const pendingBefore=await page.evaluate(()=>window.__audit.commits);await page.waitForTimeout(2200);const pendingCommits=await page.evaluate(before=>window.__audit.commits-before,pendingBefore);
  const modes=[];for(let i=0;i<repeats;i++)modes.push(await measure('.zenix-ai-panel-controls button:nth-last-child(2)',i%2===0?'.zenix-ai-compact':'.zenix-ai-workspace'));
  const evidence=await page.evaluate(()=>({...window.__audit,memory:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize}:null}));
  results.push({width,cpu:width<768?4:1,launch,cohorts,send,pendingCommits,modeTwoRafMs:summary(modes.map(x=>x.twoRaf)),evidence});await page.close();console.log(`AI tails ${label} ${width}px complete`);
 }
}finally{await writeFile(path.join(output,`${label}.json`),JSON.stringify({label,synthetic:true,repeats,widths,baseline:baselineSource!==null?{ref:baselineRef,file:'src/pages/ai/ZenixAI.jsx'}:null,notes:['Production local Chromium; every API synthetic, nonlocal traffic blocked.','4x CPU at 390px; no network throttle; chat delay 350ms.','Two rAF is frame opportunity, not physical paint; input includes scheduling and React commit, not native keyboard latency.','Long tasks and heap are whole-page observations. Small sample percentiles are descriptive.'],results,errors,blocked},null,2));await browser?.close();await new Promise(r=>vite.httpServer.close(r))}
if(errors.length)throw Error(JSON.stringify(errors));
