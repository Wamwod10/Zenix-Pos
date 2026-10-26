import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const phase=process.env.FINAL_DASH_PHASE||'after',out=`../artifacts/final-master-20261026/dashboard-${phase}`;await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();const base=server.resolvedUrls.local[0];
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
const values=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-26T07:00:00Z'));
 const product={id:'p',name:'Branch inventory',costPrice:99,stockByStore:{a:10,b:20},costByStore:{a:0,b:15}};
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==new URL(base).origin)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();let data={items:[],users:[],sessions:[],revision:'1',holds:[]};
  if(u.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'org',appRole:'OWNER',name:'Synthetic owner'}};
  if(u.pathname==='/api/bootstrap')data={catalogComplete:true,stores:[{id:'a',name:'Branch A',active:true},{id:'b',name:'Branch B',active:true}],inventory:[product],suppliers:[],activeShifts:{},organization:{id:'org',planCode:'BUSINESS',licenseStatus:'ACTIVE',expiryDate:'2099-01-01',storeLimit:3}};
  if(u.pathname==='/api/bootstrap/catalog')data={products:[product],categories:[],hasMore:false};
  if(u.pathname==='/api/settings')data={selectedStoreId:'a',workspaceSettings:{organization:{timezone:'Asia/Tashkent'}}};
  if(u.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false}};
  if(u.pathname==='/api/ai/status')data={enabled:false};
  if(u.pathname==='/api/billing/subscription')data={subscription:{planCode:'BUSINESS',status:'ACTIVE'}};
  return route.fulfill({json:{ok:true,data}});
 });
 await page.goto(base);await expect(page.locator('.dashboard-filters .premium-select').last()).toBeVisible();
 for(const [name,expected]of [['Branch A',0],['Branch B',300],['Barcha filiallar',300]]){
  await page.locator('.dashboard-filters .premium-select').last().click();await page.getByRole('option',{name,exact:true}).click();
  const value=page.locator('.pro-stat').filter({has:page.getByText('Ombor qiymati',{exact:true})}).locator('.pro-stat-copy > strong');await expect(value).not.toHaveText('—');
  const text=await value.innerText(),number=Number(text.replace(/[^0-9.-]/g,''));values.push({name,expected,actual:number,text});await page.screenshot({path:`${out}/${values.length}.png`,fullPage:true});
 }
}finally{await writeFile(`${out}/results.json`,JSON.stringify({values,errors,scope:'Actual Chromium UI, supplied synthetic branch-cost maps; no backend cost policy or production data'},null,2));await browser.close();await server.close()}
console.log(JSON.stringify({values,errors}));assert.deepEqual(errors,[]);if(phase!=='before')for(const row of values)assert.equal(row.actual,row.expected,row.name);
