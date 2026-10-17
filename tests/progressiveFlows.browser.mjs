// Real production UI + disposable loopback backend. Only fault injection is mocked.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {build,preview} from 'vite';
import {chromium} from 'playwright-core';

const out=path.resolve('../artifacts/performance-progressive-20261017');
const runtime=JSON.parse(await readFile(path.join(out,'runtime.json'),'utf8'));
const fixtures=JSON.parse(await readFile(path.join(out,'fixtures.json'),'utf8'));
const fixture=fixtures.find(row=>row.size===50000);
assert.ok(fixture,'50k disposable fixture is required');
const backend=new URL(runtime.baseURL);
assert.ok(['127.0.0.1','localhost'].includes(backend.hostname),'Refusing nonlocal backend');
assert.equal(runtime.databaseHost,'127.0.0.1:55436','Disposable database must be explicit');
const legacy=JSON.parse(await readFile(path.join(out,'bootstrap-50000-legacy.json'),'utf8')).data;
const unloaded=legacy.inventory[0];
const scanned=legacy.inventory.find(p=>p.barcode==='BC-003000');
assert.ok(scanned&&scanned.id!==unloaded.id);
const results=[],errors=[],external=[];let activePage;
await mkdir(out,{recursive:true});
const outDir=path.join(out,'flows-production');
await build({define:{'import.meta.env.VITE_API_URL':JSON.stringify('')},build:{outDir,emptyOutDir:true},logLevel:'error'});
const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:0,proxy:{'/api':{target:backend.origin,changeOrigin:true,headers:{origin:'http://localhost:5173'}}}},logLevel:'error'});
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const wait=async(predicate,message)=>{for(let n=0;n<240;n++){if(await predicate())return;await new Promise(r=>setTimeout(r,100))}assert.fail(message)};
async function data(response){const body=await response.json();assert.ok(response.ok()&&body.ok!==false,`HTTP ${response.status()}: ${JSON.stringify(body)}`);return body.data??body}
async function api(page,url,body){return data(await page.request.fetch(origin+url,{method:body===undefined?'GET':'POST',headers:{'X-Zenix-Client':'web',Origin:'http://localhost:5173'},...(body===undefined?{}:{data:body})}))}
async function cartPane(page){const tab=page.getByRole('tab',{name:/^Savat/});if(await tab.isVisible())await tab.click()}
async function catalogPane(page){const tab=page.getByRole('tab',{name:'Mahsulotlar',exact:true});if(await tab.isVisible())await tab.click()}
async function quantity(page,name,value){const row=page.locator('.cart-item').filter({hasText:name}).locator('.qty-value');await wait(async()=>await row.count()===1&&await row.textContent()===String(value),`${name} quantity must be ${value}`)}
async function switchStore(page,name){const viewport=page.viewportSize(),rotate=!(await page.locator('.header-store').isVisible());if(rotate)await page.setViewportSize({width:768,height:900});try{await page.locator('.header-store').click();await page.locator('.store-menu button').filter({hasText:name}).click();await wait(async()=>await page.locator('.header-store strong').textContent()===name,'branch selector did not change');await page.locator('.pos-product').first().waitFor()}finally{if(rotate)await page.setViewportSize(viewport)}}
try{
 for(const width of (process.env.ZENIX_FLOW_WIDTHS||'1366,768,390').split(',').map(Number)){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(30000);
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:width===390?4:1});
  page.on('pageerror',error=>errors.push({width,message:error.message}));
  let fault=false,faults=0,catalogCalls=0;
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin){external.push(url.origin);return route.abort()}
   if(url.pathname==='/api/bootstrap/catalog'){
    catalogCalls++;
    if(fault){fault=false;faults++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'INJECTED_FAULT'}})})}
   }
   return route.continue();
  });
  await page.goto(origin+'/login');
  await page.locator('input[autocomplete="username"]').fill(fixture.username);
  await page.locator('input[autocomplete="current-password"]').fill(fixture.password);
  await page.locator('.auth-submit').click();
  await page.locator('.dashboard-pro .pro-stat').first().waitFor();
  assert.ok((await page.locator('.dashboard-pro').innerText()).includes('Qoldiq hali yuklanmagan'));
  assert.ok(await page.locator('.dashboard-pro .pro-stat').count()>=4,'financial dashboard must render');
  // A real authenticated API request opens the disposable register, then the UI reloads core state.
  // bootstrap is GET-only: fetch explicit core without loading the full catalog.
  const core=await data(await page.request.get(origin+'/api/bootstrap',{headers:{'x-zenix-bootstrap':'core'}}));
  if(!core.activeShifts?.[fixture.storeId])await api(page,'/api/shifts/open',{storeId:fixture.storeId,openingCash:0});
  if(process.env.ZENIX_FLOW_REPLENISH==='1'){
   const target=legacy.inventory.find(p=>p.barcode==='BC-000002');
   const stock=await api(page,`/api/bootstrap/catalog?storeId=${fixture.storeId}&ids=${target.id}`);
   const quantity=Number(stock.products[0].stockByStore[fixture.storeId]);
   if(quantity<40)await api(page,'/api/inventory/adjust',{storeId:fixture.storeId,productId:target.id,delta:100-quantity,reason:'Disposable progressive browser flow fixture replenishment'});
  }
  await page.reload();await page.locator('.dashboard-pro').waitFor();
  if(await page.locator('.menu-toggle').isVisible())await page.locator('.menu-toggle').click();
  await page.locator('.sidebar a[href="/sales"]').click();
  await page.locator('.pos-product').first().waitFor();
  const initialStore=legacy.stores.find(s=>s.id===fixture.storeId);assert.ok(initialStore);
  if(await page.locator('.header-store strong').textContent()!==initialStore.name)await switchStore(page,initialStore.name);
  assert.equal(await page.locator('.pos-product').count(),40);
  assert.equal(await page.locator('.pos-product').filter({hasText:unloaded.name}).count(),0,'unloaded search must not start in initial page');
  const search=page.locator('.pos-search input');
  await search.fill(unloaded.sku);await page.locator('.pos-product').filter({hasText:unloaded.name}).click();
  await quantity(page,unloaded.name,1);
  // One explicit network fault must preserve the existing cart and offer retry.
  fault=true;await search.fill(scanned.sku);
  await page.locator('.pos-catalog [role="alert"]').waitFor();
  assert.equal(faults,1);await quantity(page,unloaded.name,1);
  await page.locator('.pos-catalog [role="alert"]').getByRole('button',{name:'Qayta urinish'}).click();
  await page.locator('.pos-product').filter({hasText:scanned.name}).waitFor();
  // Clear search so scanner must resolve a barcode that has not been loaded by search.
  await search.fill('');await page.locator('.pos-product').nth(39).waitFor();
  const scanTarget=legacy.inventory.find(p=>p.barcode==='BC-000002');assert.ok(scanTarget);
  await search.blur();await page.locator('.pos-search-row').click({position:{x:1,y:1}});
  for(let n=0;n<20;n++){await page.keyboard.type(scanTarget.barcode,{delay:0});await page.keyboard.press('Enter')}
  await quantity(page,scanTarget.name,20);
  assert.ok(catalogCalls>=3);
  // Immediate branch navigation exercises draft flush before its debounce expires.
  const second=legacy.stores.find(s=>s.id!==fixture.storeId),first=legacy.stores.find(s=>s.id===fixture.storeId);assert.ok(second&&first);
  await switchStore(page,second.name);assert.equal(await page.locator('.cart-item').count(),0,'branch carts must be isolated');
  await switchStore(page,first.name);await quantity(page,scanTarget.name,20);await quantity(page,unloaded.name,1);
  await page.reload();await page.locator('.pos-product').first().waitFor();await quantity(page,scanTarget.name,20);
  // Loading the legacy fallback catalog must not remount/drop active POS intent.
  if(width===1366){
   await cartPane(page);await page.locator('.cart-item').filter({hasText:unloaded.name}).getByRole('button',{name:'Miqdorni oshirish'}).click();
   await page.locator('.global-search-trigger').click();const full=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/bootstrap'&&!r.request().headers()['x-zenix-bootstrap']);
   await page.locator('.command-input input').fill(unloaded.sku);const fullResponse=await full;assert.equal(fullResponse.status(),200);await fullResponse.finished();await page.locator('.command-results button').filter({hasText:unloaded.name}).first().waitFor({timeout:60000});await page.keyboard.press('Escape');await quantity(page,unloaded.name,2);
  }
  const before=await api(page,`/api/bootstrap/catalog?storeId=${fixture.storeId}&ids=${scanTarget.id},${unloaded.id}`);
  const expectedQty=width===1366?2:1;
  await cartPane(page);await page.locator('.payment-grid button').filter({hasText:'Karta'}).click();
  const saleResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/sales'&&r.request().method()==='POST');
  await page.locator('.checkout-primary').click();
  const confirmation=page.getByRole('button',{name:/^Tasdiqlash ·/});if(await confirmation.isVisible())await confirmation.click();
  const committed=await data(await saleResponse);assert.ok(committed.id||committed.sale?.id,'server must confirm sale');
  await wait(async()=>await page.locator('.cart-item').count()===0,'confirmed sale must clear cart');
  const after=await api(page,`/api/bootstrap/catalog?storeId=${fixture.storeId}&ids=${scanTarget.id},${unloaded.id}`);
  for(const [product,qty] of [[scanTarget,20],[unloaded,expectedQty]])assert.equal(Number(after.products.find(p=>p.id===product.id).stockByStore[fixture.storeId]),Number(before.products.find(p=>p.id===product.id).stockByStore[fixture.storeId])-qty,'confirmed sale stock delta');
  // Successful checkout opens the receipt preview; close it as a cashier would.
  const receipt=page.locator('.pro-modal');if(await receipt.count())await receipt.getByRole('button',{name:'Yopish',exact:true}).first().click();
  await cartPane(page);
  // Real refund from the newly confirmed receipt, including actual server confirmation.
  await page.getByRole('button',{name:'Bugungi savdolar',exact:true}).click();
  await page.locator('.today-sales-list article').filter({hasText:scanTarget.name}).first().getByRole('button',{name:'Qaytarish',exact:true}).click();
  await page.locator('.return-items-pro button').filter({hasText:scanTarget.name}).click();
  await page.locator('.pro-modal .premium-select').last().click();await page.getByRole('option',{name:'Boshqa',exact:true}).click();
  const refundResponse=page.waitForResponse(r=>/\/api\/sales\/[^/]+\/returns$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Qaytarishni tasdiqlash',exact:true}).click();await data(await refundResponse);
  const restored=await api(page,`/api/bootstrap/catalog?storeId=${fixture.storeId}&ids=${scanTarget.id}`);
  assert.equal(Number(restored.products[0].stockByStore[fixture.storeId]),Number(after.products.find(p=>p.id===scanTarget.id).stockByStore[fixture.storeId])+1);
  results.push({width,mobileCpuRate:width===390?4:1,branchSelectionViewport:width===390?768:width,login:true,dashboard:true,remoteSearch:true,faultRetry:true,rapidScans:20,branchIsolation:true,reloadRestore:true,fullCatalogDurability:width===1366,saleStockVerified:true,refundStockVerified:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}catch(error){
 if(activePage&&!activePage.isClosed()){
  await activePage.screenshot({path:path.join(out,'flows-failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(path.join(out,'flows-failure.txt'),`${error.stack}\nURL: ${activePage.url()}\n${await activePage.locator('body').innerText()}`).catch(()=>{});
 }
 throw error;
}finally{
 await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));
 await writeFile(path.join(out,'flows-results.json'),JSON.stringify({note:'Production React UI and real disposable loopback HTTP backend; only one deliberate 503 per viewport is intercepted. No timings or benchmark claims.',results,errors,external},null,2));
}
console.log(JSON.stringify({passed:results.length,results}));
