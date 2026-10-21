// Browser workflow and latency evidence with synthetic APIs. No hardware/bank/production claims.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {posDraftKey} from '../src/utils/posDraft.js';
import {ean13CheckDigit} from '../src/pages/posPro/hardware.js';
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'}),base=`http://127.0.0.1:${server.httpServer.address().port}`;
const store='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',shift='33333333-3333-4333-8333-333333333333';
const product=i=>({id:`44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`,name:i?'Mahsulot '+i:'Olma',sku:'SKU-'+i,barcode:i?String(10000000+i):'12345678',unit:'kg',sellPrice:12000,stockByStore:{[store]:1000},archived:false});
const errors=[],results=[],output='../artifacts/phase2';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
async function setup({cartSize=0,catalogSize=10000,width=1366,height=768,closed=false,oldBackend=false,unit='kg',touch=false,longName=''}={}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,serviceWorkers:'block'}),page=await context.newPage();let sales=[],holds=[],posts=0,delay=0,fail=false,holdStatus=0,barcodeDelay=0,searchDelay=0,reconcileUnavailable=false;
 await page.addInitScript(()=>{window.print=()=>{document.documentElement.dataset.printInvoked='true'}});
 page.on('pageerror',e=>errors.push(e.message));
 if(cartSize)await page.addInitScript(({key,cart})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({v:1,cart,cartDiscountPct:0,checkoutReference:'PRO-browser-stable'}))},{key:`${posDraftKey(org,'owner',store)}:pro`,cart:Array.from({length:cartSize},(_,i)=>({...product(i),cartQty:1,discountPercent:0}))});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
  let data={users:[],sessions:[],revision:'1',holds:[]};
  if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:org,appRole:'OWNER',name:'Test kassir'}};
  if(url.pathname==='/api/bootstrap')data={catalogComplete:false,stores:[{id:store,name:'Asosiy filial',active:true}],inventory:[],suppliers:[],activeShifts:closed?{}:{[store]:{id:shift,storeId:store,status:'open'}},organization:{id:org,name:'Test market',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:2}};
  if(url.pathname==='/api/settings')data={selectedStoreId:store,workspaceSettings:{organization:{timezone:'Asia/Tashkent'},pos:{cashierDiscountAllowed:true,discountLimit:20}}};
  if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
  if(url.pathname==='/api/ai/status')data={enabled:false};
  if(url.pathname==='/api/bootstrap/catalog'){
   const ids=url.searchParams.get('ids'),barcode=url.searchParams.get('barcode'),search=url.searchParams.get('search');
   if(search&&searchDelay)await new Promise(r=>setTimeout(r,searchDelay));
   let products=[];
   if(ids)products=ids.split(',').map(id=>product(Number(id.slice(-12))-1));
   else if(barcode){if(barcodeDelay)await new Promise(r=>setTimeout(r,barcodeDelay));if(barcode==='12345678'||barcode==='00123')products=[product(0)];else if(barcode==='99999999')return route.fulfill({status:409,json:{ok:false,error:{code:'AMBIGUOUS_BARCODE'}}})}
   else if(search)products=search==='last'?[product(catalogSize-1)]:Array.from({length:40},(_,i)=>product(i)).filter(p=>p.name.includes(search)||p.sku.includes(search));
   else products=Array.from({length:40},(_,i)=>product(i));
   data={products:products.map(p=>({...p,unit,...(longName&&p.id===product(0).id?{name:longName}:{})})),categories:['Oziq-ovqat'],hasMore:!ids&&!barcode&&!search,nextCursor:'next',...(ids?{missingIds:[]}:{})};
  }
  if(url.pathname==='/api/sales/pos-pro/summary'){
   if(oldBackend)return route.fulfill({status:404,json:{ok:false,error:{code:'NOT_FOUND'}}});
   data={shift:closed?null:{id:shift},count:sales.length,total:sales.reduce((s,p)=>s+Number(p.total),0),cash:0,card:0,recent:[],popular:[{product_id:product(2).id}]};
  }
  if(url.pathname==='/api/customers')data={items:[{id:'55555555-5555-4555-8555-555555555555',name:'Ali',phone:'+998901234567'}]};
  if(url.pathname==='/api/sales/holds'){
   if(req.method()==='POST'){if(holdStatus)return route.fulfill({status:holdStatus,json:{ok:false,error:{code:'HOLD_PRODUCT_UNAVAILABLE'}}});const body=req.postDataJSON();let hold=holds.find(p=>p.clientReference===body.clientReference);if(!hold){hold={...body,id:'hold-'+holds.length};holds.push(hold)}data={hold}}
   else data={holds};
  }
  if(url.pathname.startsWith('/api/sales/holds/')&&req.method()==='DELETE'){holds=holds.filter(h=>h.id!==url.pathname.split('/').at(-1));data={deleted:true}}
  if(url.pathname==='/api/sales'&&req.method()==='POST'){
   posts++;const body=req.postDataJSON();let sale=sales.find(p=>p.client_reference===body.clientReference);
   if(!sale){sale={id:'66666666-6666-4666-8666-'+String(sales.length+1).padStart(12,'0'),sale_number:'S-'+(sales.length+1),client_reference:body.clientReference,total:body.payments.reduce((s,p)=>s+p.amount,0)+body.creditAmount,created_at:new Date().toISOString(),request:body};sales.push(sale)}
   if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)return route.abort();data={sale};
  }
  if(url.pathname==='/api/sales/reconciliation'){if(reconcileUnavailable)return route.fulfill({status:503,json:{ok:false,error:{code:'API_ERROR'}}});data=sales.length?{state:'confirmed',sale:sales.at(-1)}:{state:'unknown'}}
  await route.fulfill({json:{ok:true,data}});
 });
 const start=performance.now();await page.goto(base+'/pos-pro');await expect(page.locator('.pp-product').first()).toBeEnabled();
 results.push({kind:'load',cartSize,catalogSize,width,ms:performance.now()-start});
 return {page,context,get sales(){return sales},get holds(){return holds},get posts(){return posts},set delay(ms){delay=ms},set fail(value){fail=value},set holdStatus(value){holdStatus=value},set barcodeDelay(value){barcodeDelay=value},set searchDelay(value){searchDelay=value},set reconcileUnavailable(value){reconcileUnavailable=value}};
}
try{
 const benchmark=process.env.POS_PRO_SEARCH_BENCHMARK;
 if(benchmark){
  for(const cartSize of [100,500]){
   const r=await setup({cartSize,catalogSize:50000}),p=r.page;
   await expect(p.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();await expect(p.locator('.pp-products')).toHaveAttribute('aria-busy','false');
   await p.evaluate(()=>{
    window.__searchSamples=[];let current=null;
    document.addEventListener('input',e=>{if(e.target.getAttribute('aria-label')==='POS Pro qidiruv')current={query:e.target.value,start:performance.now()}},true);
    const original=window.fetch;window.fetch=async(...args)=>{
     const url=new URL(args[0],location.href),sample=current;
     if(!sample||url.pathname!=='/api/bootstrap/catalog'||url.searchParams.get('search')!==sample.query)return original(...args);
     sample.request=performance.now();const response=await original(...args),json=response.json.bind(response);
     response.json=async()=>{const data=await json();sample.response=performance.now();const expected=sample.query==='last'?'Mahsulot 49999':'Olma';
      const painted=()=>{if(!document.querySelector('.pp-products')?.textContent.includes(expected)){requestAnimationFrame(painted);return}requestAnimationFrame(()=>{const end=performance.now();window.__searchSamples.push({debounceMs:sample.request-sample.start,requestJsonMs:sample.response-sample.request,renderPaintMs:end-sample.response,totalMs:end-sample.start})})};requestAnimationFrame(painted);return data;
     };return response;
    };
   });
   for(let i=0;i<7;i++){await p.getByLabel('POS Pro qidiruv').fill(i%2?'Olma':'last');await p.waitForFunction(n=>window.__searchSamples.length>=n,i+1)}
   results.push({kind:'isolated-search-stages',cartSize,catalogSize:50000,heap:await p.evaluate(()=>({used:performance.memory?.usedJSHeapSize,total:performance.memory?.totalJSHeapSize,domNodes:document.querySelectorAll('*').length})),samples:await p.evaluate(()=>window.__searchSamples.slice(1))});await r.context.close();
  }
 }else{
 const uxOnly=process.env.POS_PRO_UX_ONLY;
 if(!uxOnly||uxOnly==='hold-retry'){
  const r=await setup(),p=r.page;await p.locator('.pp-product').first().click();r.holdStatus=503;await p.keyboard.press('F5');await expect(p.locator('.pp-recovery')).toBeVisible();r.holdStatus=0;await p.getByRole('button',{name:'Hold saqlashni qayta tekshirish',exact:true}).click();await expect(p.locator('.pp-cart-line')).toHaveCount(0);assert.equal(r.holds.length,1);await r.context.close();
 }
 if(!uxOnly||uxOnly==='search'){
  const r=await setup(),p=r.page,barcodes=[];p.on('request',req=>{const u=new URL(req.url());if(u.searchParams.has('barcode'))barcodes.push(u.searchParams.get('barcode'))});
  const input=p.getByLabel('POS Pro qidiruv');await input.fill('Olma');await expect(p.locator('.pp-product')).toHaveCount(1);await expect(p.locator('.pp-product')).toBeEnabled();await input.press('Enter');await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('1');
  await input.fill('SKU-0');await expect(p.locator('.pp-product')).toHaveCount(1);await expect(p.locator('.pp-product')).toBeEnabled();await input.press('Enter');await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');
  r.searchDelay=400;await input.fill('SKU-39');await input.press('Enter');await expect(p.locator('.pp-cart-line')).toHaveCount(1);await expect(p.locator('.pp-product')).toContainText('Mahsulot 39');await expect(p.locator('.pp-product')).toBeEnabled();await input.press('Enter');await expect(p.getByLabel('Mahsulot 39 miqdori',{exact:true})).toHaveValue('1');r.searchDelay=0;
  await input.fill('Mahsulot');await expect(p.locator('.pp-product').first()).toContainText('Mahsulot');await expect(p.locator('.pp-product')).toHaveCount(39);await input.press('Enter');await expect(p.locator('.pp-cart-line')).toHaveCount(2);await input.press('ArrowDown');await input.press('ArrowDown');await input.press('Enter');await expect(p.getByLabel('Mahsulot 2 miqdori',{exact:true})).toHaveValue('1');assert.deepEqual(barcodes,[]);await r.context.close();
 }
 if(!uxOnly||uxOnly==='popular'){
  const r=await setup(),p=r.page,input=p.getByLabel('POS Pro qidiruv');await input.fill('Olma');await expect(p.locator('.pp-product')).toHaveCount(1);await expect(p.locator('.pp-product')).toBeEnabled();await p.getByRole('button',{name:/Smenada/}).click();await expect(p.locator('.pp-product')).toContainText('Mahsulot 2');await input.press('Enter');await expect(p.locator('.pp-cart-line')).toHaveCount(0);await expect(input).toHaveValue('');await p.locator('.pp-product').click();await expect(p.getByLabel('Mahsulot 2 miqdori',{exact:true})).toHaveValue('1');await r.context.close();
 }
 if(!uxOnly||uxOnly==='long'){
  for(const [width,height]of [[1366,768],[1920,1080],[1024,768],[390,844]]){const r=await setup({width,height,longName:'Long supermarket product name '.repeat(12)}),p=r.page;await p.locator('.pp-product').first().click();await expect(p.locator('.pp-cart-line')).toHaveCount(1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'long name overflow '+width);await r.context.close()}
 }
 if(!uxOnly||uxOnly==='touch'){
  const r=await setup({width:1024,height:768,touch:true}),p=r.page;await p.locator('.pp-product').first().tap();await expect(p.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();await p.getByRole('button',{name:'Olma miqdorini oshirish',exact:true}).tap();await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('1.05');assert.ok(await p.evaluate(()=>navigator.maxTouchPoints>0));await r.context.close();
 }
 if(!uxOnly||uxOnly==='quantity'){
  for(const [unit,initial,lower]of [['kg','0.75','0.7'],['l','0.75','0.7'],['g','750','700'],['dona','2','1']]){
   const r=await setup({unit}),p=r.page;await p.locator('.pp-product').first().click();const field=p.getByLabel('Olma miqdori',{exact:true});await field.fill(initial);await field.press('Enter');const down=p.getByRole('button',{name:'Olma miqdorini kamaytirish',exact:true});await expect(down).toBeEnabled();await down.click();await expect(field).toHaveValue(lower);await p.getByRole('button',{name:'Olma miqdorini oshirish',exact:true}).click();await expect(field).toHaveValue(initial);await r.context.close();
  }
 }
 if(!uxOnly||uxOnly==='currency'){
  const r=await setup(),p=r.page;await p.locator('.pp-product').first().click();await p.keyboard.press('F7');await expect(p.locator('.pp-payment-total')).toBeVisible();assert.equal((await p.locator('.pp-payment-total').textContent()).match(/so‘m/g)?.length,1);await r.context.close();
 }
 if(!uxOnly||uxOnly==='receipt'){
  for(const unit of ['kg','l'])for(const recovery of [false,true]){
   const r=await setup({unit}),p=r.page;await p.locator('.pp-product').first().click();const field=p.getByLabel('Olma miqdori',{exact:true});await field.fill('0.75');await field.press('Enter');await p.keyboard.press('F7');await p.getByLabel('Mijoz bergan naqd',{exact:true}).fill('10000');await p.getByRole('checkbox').check();if(recovery){r.fail=true;r.reconcileUnavailable=true}await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();
   if(recovery){await expect(p.locator('.pp-recovery')).toBeVisible();await p.reload();await expect(p.locator('.pp-recovery')).toBeVisible();r.reconcileUnavailable=false;await p.getByRole('button',{name:'Natijani tekshirish',exact:true}).click()}
   await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();const body=p.frameLocator('.pp-receipt-preview').locator('body');await expect(body).toContainText(`0.75 ${unit}`);await expect(body).toContainText(/Naqd: 9[ ,]000/);await expect(body).toContainText(/Berildi: 10[ ,]000/);await expect(body).toContainText(/Qaytim: 1[ ,]000/);assert.equal(r.posts,1);await r.context.close();
  }
 }
 if(!uxOnly){
 const reviewOnly=process.env.POS_PRO_REVIEW_ONLY;
 if(!reviewOnly||reviewOnly==='hold'){
  const r=await setup();await r.page.locator('.pp-product').first().click();r.holdStatus=409;await r.page.keyboard.press('F5');
  await expect(r.page.locator('.pp-error').first()).toBeVisible();await expect(r.page.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();await expect(r.page.locator('.pp-recovery')).toHaveCount(0);assert.equal(r.holds.length,0);await r.context.close();
 }
 if(!reviewOnly||reviewOnly==='scan'){
  const r=await setup();await r.page.locator('.pp-product').first().click();r.barcodeDelay=800;await r.page.getByRole('heading',{name:'Joriy chek',exact:true}).click();await r.page.keyboard.type('12345678',{delay:6});await r.page.keyboard.press('Enter');await r.page.keyboard.press('F5');
  await expect(r.page.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');assert.equal(r.holds.length,0);await r.context.close();
 }
 if(!reviewOnly){
 {
  const r=await setup(),p=r.page;
  await p.evaluate(({key,schemes})=>localStorage.setItem(key,JSON.stringify(schemes)),{key:`zenix:pos-pro-device:v1:${org}:owner:${store}`,schemes:[{prefix:'21',productStart:2,productLength:5,valueStart:7,valueLength:5,divisor:1000,unit:'kg'}]});await p.reload();
  const body='210012301250',code=body+ean13CheckDigit(body);await expect(p.getByLabel('Barcode',{exact:true})).toBeEnabled();await p.getByLabel('Barcode',{exact:true}).fill(code);await p.getByLabel('Barcode',{exact:true}).press('Enter');await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('1.25');
  await p.getByLabel('Olma chegirma',{exact:true}).fill('10');await p.getByLabel('Savat chegirmasi',{exact:true}).fill('10');await expect(p.getByTestId('pos-pro-total')).toContainText(/12[ ,]150/);
  await r.context.setOffline(true);await expect(p.locator('.pp-offline')).toBeVisible();assert.equal(r.posts,0);await r.context.setOffline(false);await p.reload();await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('1.25');await r.context.close();
 }
 {
  const r=await setup(),p=r.page;await p.locator('.pp-product').first().click();await p.keyboard.press('F8');await p.getByText('Bank terminali / o‘tkazma muvaffaqiyatini tekshirdim.',{exact:false}).click();await p.getByText('Chek va to‘lov summasini tekshirdim.',{exact:false}).click();r.fail=true;r.reconcileUnavailable=true;await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();await expect(p.locator('.pp-recovery')).toBeVisible();await expect(p.getByLabel('Olma miqdori',{exact:true})).toBeDisabled();
  await p.reload();await expect(p.locator('.pp-recovery')).toBeVisible();r.reconcileUnavailable=false;await p.getByRole('button',{name:'Natijani tekshirish',exact:true}).click();await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();assert.equal(r.sales.length,1);assert.equal(r.posts,1);await r.context.close();
 }
 const s=await setup(),p=s.page;
 await expect(p.getByRole('link',{name:'⚡ POS Pro',exact:true}).first()).toBeVisible();
 await p.getByRole('heading',{name:'Joriy chek',exact:true}).click();
 const start=performance.now();for(let i=0;i<10;i++){await p.keyboard.type('12345678',{delay:6});await p.keyboard.press('Enter')}
 await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('10');results.push({kind:'ten-HID-scans',ms:performance.now()-start});
 await p.getByLabel('Barcode',{exact:true}).fill('99999999');await p.getByLabel('Barcode',{exact:true}).press('Enter');await expect(p.locator('.pp-error').first()).toBeVisible();assert.equal(await p.locator('.pp-cart-line').count(),1);
 await p.keyboard.press('F3');await expect(p.getByLabel('Barcode',{exact:true})).toBeFocused();
 await p.getByLabel('Barcode',{exact:true}).fill('unknown');await p.getByLabel('Barcode',{exact:true}).press('Enter');await expect(p.locator('.pp-error').first()).toContainText('topilmadi');
 await p.keyboard.press('F5');await expect(p.locator('.pp-cart-line')).toHaveCount(0);await p.keyboard.press('F6');await p.locator('.pp-holds button').first().click();await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('10');
 await p.keyboard.press('F7');await expect(p.getByRole('dialog',{name:'To‘lov — Naqd'})).toBeVisible();await p.getByLabel('Mijoz bergan naqd',{exact:true}).fill('150000');await expect(p.locator('.pp-change')).toContainText('30');
 await p.getByRole('checkbox').check();s.delay=400;await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).dblclick({delay:20});await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();assert.equal(s.posts,1);assert.equal(s.sales[0].request.metadata.source,'pos-pro');assert.equal(s.sales[0].request.payments[0].amount,120000);
 await expect(p.frameLocator('.pp-receipt-preview').locator('body')).toContainText('Olma');await p.keyboard.press('F10');await expect(p.locator('iframe[title="POS Pro chek"]')).toHaveCount(1);await expect(p.frameLocator('iframe[title="POS Pro chek"]').locator('html')).toHaveAttribute('data-print-invoked','true');await p.locator('iframe[title="POS Pro chek"]').evaluate(el=>el.remove());await p.getByRole('button',{name:'Yangi chek',exact:true}).click();
 await p.locator('.pp-product').first().click();await p.keyboard.press('F8');await expect(p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true})).toBeDisabled();
 await p.getByText('Bank terminali / o‘tkazma muvaffaqiyatini tekshirdim.',{exact:false}).click();await p.getByText('Chek va to‘lov summasini tekshirdim.',{exact:false}).click();s.fail=true;await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();assert.equal(s.sales.length,2);assert.equal(s.sales[1].request.metadata.externalPaymentConfirmation,'manual-confirmed');
 await p.getByRole('button',{name:'Yangi chek',exact:true}).click();await p.getByRole('button',{name:'Kiosk rejimi',exact:true}).click();await expect(p.locator('.pp-kiosk')).toBeVisible();await p.keyboard.press('Escape');await expect(p.locator('.pp-kiosk')).toHaveCount(0);
 await p.screenshot({path:output+'/desktop-1366.png',fullPage:true});await s.context.close();
 for(const [width,height] of [[1920,1080],[1024,768],[390,844]]){
  const r=await setup({width,height,oldBackend:width===390});await r.page.locator('.pp-product').first().click();assert.ok(await r.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`horizontal overflow at ${width}`);await r.page.screenshot({path:`${output}/layout-${width}.png`,fullPage:true});await r.context.close();
 }
 for(const cartSize of [100,500]){
  const r=await setup({cartSize,catalogSize:50000});await expect(r.page.locator('.pp-cart-line')).toHaveCount(cartSize);
  const start=performance.now();await r.page.getByLabel('Olma miqdori',{exact:true}).fill('2');await r.page.getByLabel('Olma miqdori',{exact:true}).press('Enter');await expect(r.page.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');results.push({kind:'cart-edit',cartSize,ms:performance.now()-start});
  await r.page.reload();await expect(r.page.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');
  const t=performance.now();await r.page.getByLabel('POS Pro qidiruv').fill('last');await expect(r.page.locator('.pp-product').first()).toContainText('49999');results.push({kind:'50k-tail-search',cartSize,ms:performance.now()-t,renderedProducts:await r.page.locator('.pp-product').count()});await r.context.close();
 }
 const closed=await setup({closed:true});await closed.page.locator('.pp-product').first().click();await expect(closed.page.getByRole('button',{name:'Savdoni yakunlash F12'})).toBeDisabled();await closed.context.close();
 }
 }
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors,scope:'Synthetic API browser workflows; not physical hardware or database load'},null,2));
}finally{await writeFile(output+`/${process.env.POS_PRO_SEARCH_BENCHMARK?'search-benchmark-'+process.env.POS_PRO_SEARCH_BENCHMARK:'browser-results'}.json`,JSON.stringify({results,errors},null,2));await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
