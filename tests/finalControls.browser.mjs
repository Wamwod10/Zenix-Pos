// Local production-bundle control audit. Never contacts a real API.
import {chromium} from 'playwright-core';
import {preview,build} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('../artifacts/performance-continuation-20261016/final-controls');
await mkdir(output,{recursive:true});
const outDir=path.join(output,'build');
await build({build:{outDir,emptyOutDir:true},logLevel:'error'});
const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const store='11111111-1111-4111-8111-111111111111';
const customer={id:'customer-a',name:'Synthetic Customer',customerType:'REGULAR',loyaltyTier:'STANDARD',tags:[],balance:0,totalPurchases:0,saleCount:0};
const operations=[],requests=[],runtimeErrors=[],blocked=[],modules=[];
let browser,page,mode='success';
async function check(module,control,work){try{const evidence=await work();operations.push({module,control,status:'passed',...evidence});}catch(e){operations.push({module,control,status:'failed',error:e.message});}}
async function measure(action,ready){
 await page.evaluate(()=>{window.__controlStart=performance.now();window.__firstMutation=null;window.__controlObserver?.disconnect();window.__controlObserver=new MutationObserver(()=>{if(window.__firstMutation===null)window.__firstMutation=performance.now()-window.__controlStart});window.__controlObserver.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});});
 await action();await ready();
 return page.evaluate(()=>{window.__controlObserver.disconnect();return {firstDOMMutationMs:window.__firstMutation,usableObservedMs:performance.now()-window.__controlStart}});
}
async function go(route){await page.goto(base+route);await page.locator('main.content h1').waitFor();await page.waitForTimeout(350);}
async function closeModal(){await page.getByRole('dialog').last().getByRole('button',{name:'Yopish',exact:true}).first().click();await page.getByRole('dialog').waitFor({state:'hidden'});}
async function modal(module,name,save='Saqlash'){
 const trigger=page.getByRole('button',{name,exact:true}).first();
 if(!await trigger.count()){operations.push({module,control:`modal: ${name}`,status:'not present in fixture'});return;}
 await check(module,`open modal: ${name}`,async()=>measure(()=>trigger.click(),()=>page.getByRole('dialog').waitFor()));
 if(!await page.getByRole('dialog').count())return;
 const button=page.getByRole('dialog').getByRole('button',{name:save,exact:true});
 if(await button.count())await check(module,'empty save validation',async()=>{
  const validation=page.getByRole('dialog').locator('.pro-alert.danger,.field-error').first();
  const timing=await measure(()=>button.click(),()=>validation.waitFor());
  assert(await page.getByRole('dialog').isVisible());return {...timing,message:await validation.innerText()};
 });
 await check(module,'modal close',async()=>{await closeModal();return {closed:true};});
}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 page=await browser.newPage({viewport:{width:1366,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 page.setDefaultTimeout(5000);page.on('pageerror',e=>runtimeErrors.push(e.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base){blocked.push(url.origin);return route.abort();}
  if(!url.pathname.startsWith('/api/'))return route.continue();
  requests.push({method:request.method(),path:url.pathname,query:url.search,mode});
  let data={users:[],sessions:[],revision:'1',holds:[]};
  if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'synthetic-org',appRole:'OWNER',name:'Test'}};
  if(url.pathname==='/api/bootstrap')data={stores:[{id:store,name:'Test',active:true}],inventory:[],suppliers:[],employees:[],activeShifts:{[store]:{id:'shift',storeId:store,status:'open',openedAtISO:new Date().toISOString()}},organization:{id:'synthetic-org',name:'Synthetic',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:3}};
  if(url.pathname==='/api/settings')data={selectedStoreId:store};
  if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
  if(url.pathname==='/api/customers'&&request.method()==='GET')data={items:[customer],total:1};
  if(url.pathname==='/api/customers/stats')data={totalCustomers:1,aging:{}};
  if(url.pathname==='/api/customers/tags')data={configured:['VIP'],existing:[]};
  if(url.pathname==='/api/customers/customer-a')data={customer,ledger:[],sales:[],returns:[],openCredits:[],pages:{}};
  if(url.pathname==='/api/billing/plans')data={plans:[]};
  if(url.pathname==='/api/billing/subscription')data={subscription:{planCode:'BUSINESS',limits:{stores:3},status:'ACTIVE'}};
  if(url.pathname==='/api/billing/limits')data={resources:{stores:{used:1,limit:3}}};
  if(url.pathname==='/api/ai/status')data={enabled:true,writable:true,writesEnabled:false,limit:1000,remaining:1000,suggestions:[]};
  if(url.pathname.endsWith('/progress'))data={phase:'reading_inventory'};
  if(request.method()!=='GET'){
   await new Promise(resolve=>setTimeout(resolve,700));
   if(mode==='failure')return route.fulfill({status:503,json:{ok:false,error:{code:'SYNTHETIC_FAILURE',message:'Synthetic service unavailable'}}});
   if(url.pathname==='/api/ai/chat')data={conversationId:'33333333-3333-4333-8333-333333333333',answer:'Synthetic answer',actions:[],insights:[]};
   else if(url.pathname.startsWith('/api/customers'))data={customer};
  }
  await route.fulfill({json:{ok:true,data}});
 });
 await go('/sales');await page.locator('.zenix-ai-trigger').waitFor();
 const routes=[['Dashboard','/'],['POS','/sales'],['Products','/products'],['Inventory','/inventory'],['Sales','/history'],['Customers','/customers'],['Suppliers','/suppliers'],['Expenses','/expenses'],['Analytics','/analytics'],['Reports','/seller-analytics'],['Settings','/settings'],['Billing','/billing']];
 for(const [module,route] of routes){
  await go(route);
  modules.push({module,route,heading:(await page.locator('main.content').innerText()).slice(0,160)});
  const searchCandidates=page.locator('main.content input[placeholder*="qidir"],main.content input[placeholder*="Nomi"],main.content input[aria-label*="qidir"]');
  if(await searchCandidates.count())await check(module,'search input and reset',async()=>{
   const input=searchCandidates.first();await input.fill('Synthetic');assert.equal(await input.inputValue(),'Synthetic');await input.fill('');return {input:await input.getAttribute('placeholder'),scope:'input state only; empty dataset cannot establish result correctness'};
  });
  const select=page.locator('main.content button[aria-haspopup="listbox"]:visible:not([disabled])').first();
  if(await select.count())await check(module,'dropdown open, choose alternate option',async()=>{
   const before=await select.innerText();const timing=await measure(()=>select.click(),()=>page.getByRole('listbox').waitFor());
   const options=page.getByRole('option');const labels=await options.allTextContents();
   const target=page.getByRole('option').filter({hasText:labels.find(x=>x.trim()!==before.trim())||labels[0]}).first();
   if(await target.isEnabled())await target.click();else await page.keyboard.press('Escape');
   await page.getByRole('listbox').waitFor({state:'hidden'});return {...timing,before,after:await select.innerText(),options:labels};
  });
  const columns=page.locator('main.content .column-picker-trigger').first();
  if(await columns.count())await check(module,'column menu open, toggle and restore',async()=>{
   const timing=await measure(()=>columns.click(),()=>page.locator('.column-picker-menu').waitFor());
   const item=page.locator('.column-picker-check').first(),before=await item.getAttribute('aria-pressed');await item.click();assert.notEqual(await item.getAttribute('aria-pressed'),before);await item.click();assert.equal(await item.getAttribute('aria-pressed'),before);await columns.click();return {...timing,restored:true};
  });
  if(module==='Products')await modal(module,'Katalog yozuvi');
  if(module==='Inventory')await modal(module,'Kirim','Kirimni tasdiqlash');
  if(module==='Customers')await modal(module,'Mijoz qo‘shish');
  if(module==='Suppliers')await modal(module,'Ta’minotchi qo‘shish');
  if(module==='Expenses')await modal(module,'Xarajat qo‘shish');
 }
 await go('/customers');
 await check('Customers','search sends scoped directory query',async()=>{const start=requests.length;await page.getByRole('textbox',{name:'Mijozlarni qidirish'}).fill('needle');await page.waitForTimeout(400);assert(requests.slice(start).some(r=>r.path==='/api/customers'&&r.query.includes('q=needle')));return {requestObserved:true,fixtureDoesNotFilter:true};});
 await go('/customers');
 await check('Customers','create pending and server error retains form',async()=>{
  await page.getByRole('button',{name:'Mijoz qo‘shish',exact:true}).click();await page.getByRole('dialog').locator('input').first().fill('Synthetic New');mode='failure';
  const timing=await measure(()=>page.getByRole('dialog').getByRole('button',{name:'Saqlash',exact:true}).click(),()=>page.getByRole('button',{name:'Saqlanmoqda...',exact:true}).waitFor());
  assert(await page.getByRole('button',{name:'Saqlanmoqda...',exact:true}).isDisabled());await page.getByRole('dialog').locator('.pro-alert.danger').waitFor();assert.equal(await page.getByRole('dialog').locator('input').first().inputValue(),'Synthetic New');mode='success';return {...timing,mockDelayMs:700,errorVisible:true,draftRetained:true};
 });
 await check('Customers','create successful retry closes dialog',async()=>{await page.getByRole('dialog').getByRole('button',{name:'Saqlash',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});return {response:'synthetic success',persistenceVerified:false};});
 await check('Customers','detail, edit, pending save and completion',async()=>{
  await page.locator('.customer-card').first().click();await page.getByRole('button',{name:'Tahrirlash',exact:true}).click();await page.getByRole('dialog').locator('input').first().fill('Synthetic Edited');
  const timing=await measure(()=>page.getByRole('dialog').getByRole('button',{name:'Saqlash',exact:true}).click(),()=>page.getByRole('button',{name:'Saqlanmoqda...',exact:true}).waitFor());
  await page.getByRole('dialog',{name:'Mijozni tahrirlash'}).waitFor({state:'hidden'});return {...timing,mockDelayMs:700,patchObserved:requests.some(r=>r.method==='PATCH'&&r.path==='/api/customers/customer-a'),persistenceVerified:false};
 });
 await go('/settings');
 for(const tab of ['Filiallar','Xodimlar'])await check(tab==='Filiallar'?'Branches':'Staff',`${tab} settings tab`,async()=>{
  const timing=await measure(()=>page.getByRole('button',{name:tab,exact:true}).click(),()=>page.locator('main.content').getByRole('heading',{name:tab==='Filiallar'?'Filiallar':'Xodimlar',exact:true}).waitFor());return timing;
 });
 await modal('Staff','+ Xodim qo‘shish','Xodimni yaratish');
 await check('AI','open, send pending, answer, close',async()=>{
  const open=await measure(()=>page.locator('.zenix-ai-trigger').click(),()=>page.locator('#zenix-ai-question').waitFor());await page.locator('#zenix-ai-question').fill('Synthetic control audit');
  const pending=await measure(()=>page.locator('#zenix-ai-question').press('Enter'),()=>page.locator('.zenix-ai-thinking').waitFor());await page.locator('.zenix-ai-answer').waitFor();await page.getByRole('button',{name:'AI panelini yopish',exact:true}).click();return {open,pending,mockDelayMs:700,answerObserved:true};
 });
 await page.screenshot({path:path.join(output,'final-controls.png'),fullPage:false});
}finally{
 const report={synthetic:true,productionBundle:true,viewport:{width:1366,height:900},notes:['All local /api requests fulfilled with synthetic fixtures; all external origins blocked; service workers blocked.','Timing starts before Playwright action and includes automation overhead. First mutation may be focus/attribute/skeleton; usableObserved waits for the named control state, not physical paint. Single observations are not percentiles.','Search/dropdown smoke checks on empty fixtures do not verify result filtering. Customer query assertion verifies query dispatch only.','Reports maps to existing seller analytics route; no separate reports route asserted. Branches and Staff are Settings tabs.','Delete and financial checkout/refund/payment persistence are not covered. No live service, production database, OpenAI or backend performance exercised.','Synthetic customer writes return success without persistence; this establishes UI transition and request path, not data integrity.'],modules,operations,requests,runtimeErrors,blocked,summary:{passed:operations.filter(x=>x.status==='passed').length,failed:operations.filter(x=>x.status==='failed').length,gaps:operations.filter(x=>x.status==='not present in fixture').length}};
 await writeFile(path.join(output,'final-controls.json'),JSON.stringify(report,null,2));
 await writeFile(path.join(output,'final-controls.md'),`Local production Chromium controls audit; 1366px; synthetic APIs only.\n\n| Module | Control | Status |\n|---|---|---|\n${operations.map(x=>`| ${x.module} | ${x.control} | ${x.status}${x.error?`: ${x.error.replaceAll('|','/').split('\n')[0]}`:''} |`).join('\n')}\n\n${report.notes.join('\n\n')}\n\nRuntime errors: ${runtimeErrors.length}. Passed: ${report.summary.passed}; failed: ${report.summary.failed}; missing fixture controls: ${report.summary.gaps}.\n`);
 console.log(JSON.stringify(report.summary));await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));
}
if(operations.some(x=>x.status==='failed')||runtimeErrors.length)process.exitCode=1;
