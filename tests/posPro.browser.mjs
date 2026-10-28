// Browser workflow and latency evidence with synthetic APIs. No hardware/bank/production claims.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {posDraftKey} from '../src/utils/posDraft.js';
import {simulateHid} from './helpers/posHid.mjs';
import {ean13CheckDigit} from '../src/pages/posPro/hardware.js';
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'}),base=`http://127.0.0.1:${server.httpServer.address().port}`;
const store='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',shift='33333333-3333-4333-8333-333333333333';
const product=i=>({id:`44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`,name:i?'Mahsulot '+i:'Olma',sku:'SKU-'+i,barcode:i?String(10000000+i):'12345678',unit:'kg',sellPrice:12000,stockByStore:{[store]:1000},archived:false,...((process.env.POS_PRO_UX_ONLY||'').startsWith('deep-')?{name:'Tabiiy sutli shokolad va yong‘oqli supermarket mahsuloti katta oilalar uchun '+i,unit:['kg','l','dona'][i%3],sellPrice:i%2?1250000000:1250000,stockBatches:[{id:'batch-'+i,storeId:store,batchNo:'FEFO-2027-001',remaining:1000,quantity:1000,expiryDate:'2027-01-01',status:'IN_STOCK'}]}:{})});
const errors=[],results=[],output=process.env.POS_DEEP_PHASE?`../artifacts/pos-pro-deep/${process.env.POS_DEEP_PHASE}`:'../artifacts/phase2';await mkdir(output,{recursive:true});await mkdir('../artifacts/phase3-polish',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
async function setup({cartSize=0,catalogSize=10000,width=1366,height=768,closed=false,oldBackend=false,unit='kg',touch=false,longName='',serial=false,presentation=false,stress=false,shiftConflict='',otherShiftCashier='',appRole='OWNER'}={}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();let sales=[],holds=[],posts=0,delay=0,fail=false,holdStatus=0,barcodeDelay=0,searchDelay=0,reconcileUnavailable=false,rejectStatus=0;
 await page.addInitScript(()=>{window.print=()=>{document.documentElement.dataset.printInvoked='true'}});
 page.on('pageerror',e=>errors.push(e.message));
 if(cartSize)await page.addInitScript(({key,cart})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({v:1,cart,cartDiscountPct:0,checkoutReference:'PRO-browser-stable'}))},{key:`${posDraftKey(org,'owner',store)}:pro`,cart:Array.from({length:cartSize},(_,i)=>({...product(i),cartQty:1,discountPercent:0}))});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
  let data={users:[],sessions:[],revision:'1',holds:[]};
  if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:org,appRole,storeId:store,name:stress?'Juda uzoq ism va familiyali supermarket kassiri':'Test kassir'}};
  if(url.pathname==='/api/bootstrap')data={catalogComplete:false,stores:[{id:store,name:stress?'Supermarketning juda uzoq nomli markaziy filiali':'Asosiy filial',active:true}],inventory:[],suppliers:[],activeShifts:closed?{}:{[store]:{id:shift,storeId:store,status:'open'}},organization:{id:org,name:'Test market',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:2}};
  if(url.pathname==='/api/bootstrap'&&otherShiftCashier){const otherStore='77777777-7777-4777-8777-777777777777';data.stores.push({id:otherStore,name:'2-Filial',active:true});data.activeShifts[otherStore]={id:shift,storeId:otherStore,storeName:'2-Filial',cashierId:otherShiftCashier,cashierAccountId:otherShiftCashier,status:'open',openedAtISO:'2026-10-11T09:10:43.000Z',openedAt:'14:10',openingCash:0,cashMovements:[]}}
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
   data={products:products.map(p=>({...p,unit,...(presentation?{name:['Olma','Tuxum','Guruch','Sut','Ichimlik suvi'][Number(p.id.slice(-12))-1]||p.name,unit:['kg','dona','g','l','ml'][(Number(p.id.slice(-12))-1)%5],sellPrice:[12000,1500,18,14000,4][(Number(p.id.slice(-12))-1)%5],stockByStore:{[store]:[18.75,120,5000,24,10000][(Number(p.id.slice(-12))-1)%5]}}:{}),...(longName&&p.id===product(0).id?{name:longName}:{}),...(stress?{barcode:'12345678901234567890123456789012345678901234567890'}:{}),...(serial&&p.id===product(0).id?{unit:'dona',serializedUnits:[{id:'s1',serial:'S1',storeId:store,productId:p.id,status:'IN_STOCK'},{id:'s2',serial:'S2',storeId:store,productId:p.id,status:'IN_STOCK'}]}:{})})),categories:['Oziq-ovqat'],hasMore:!ids&&!barcode&&!search,nextCursor:'next',...(ids?{missingIds:[]}:{})};
  }
  if(url.pathname==='/api/sales/pos-pro/summary'){
   if(oldBackend)return route.fulfill({status:404,json:{ok:false,error:{code:'NOT_FOUND'}}});
   data={shift:closed?null:{id:shift},count:sales.length,total:sales.reduce((s,p)=>s+Number(p.total),0),cash:0,card:0,recent:[],popular:[{product_id:product(2).id}]};
  }
  if(url.pathname==='/api/shifts/open'&&req.method()==='POST'){if(shiftConflict)return route.fulfill({status:409,json:{ok:false,error:{code:shiftConflict,message:'internal-private-detail'}}});closed=false;data={shift:{id:shift,store_id:store,cashier_id:'owner',opening_cash:req.postDataJSON().openingCash,status:'open',opened_at:new Date().toISOString(),metadata:{}}}}
  if(url.pathname==='/api/customers')data={items:[{id:'55555555-5555-4555-8555-555555555555',name:'Ali',phone:'+998901234567'}]};
  if(url.pathname==='/api/sales/holds'){
   if(req.method()==='POST'){if(holdStatus)return route.fulfill({status:holdStatus,json:{ok:false,error:{code:'HOLD_PRODUCT_UNAVAILABLE'}}});const body=req.postDataJSON();let hold=holds.find(p=>p.clientReference===body.clientReference);if(!hold){hold={...body,id:'hold-'+holds.length};holds.push(hold)}data={hold}}
   else data={holds};
  }
  if(url.pathname.startsWith('/api/sales/holds/')&&req.method()==='DELETE'){holds=holds.filter(h=>h.id!==url.pathname.split('/').at(-1));data={deleted:true}}
  if(url.pathname==='/api/sales'&&req.method()==='POST'){
   posts++;if(rejectStatus)return route.fulfill({status:rejectStatus,json:{ok:false,error:{code:'INSUFFICIENT_STOCK',message:'Server: qoldiq yetarli emas'}}});const body=req.postDataJSON();let sale=sales.find(p=>p.client_reference===body.clientReference);
   if(!sale){sale={id:'66666666-6666-4666-8666-'+String(sales.length+1).padStart(12,'0'),sale_number:'S-'+(sales.length+1),client_reference:body.clientReference,total:body.payments.reduce((s,p)=>s+p.amount,0)+body.creditAmount,created_at:new Date().toISOString(),request:body};sales.push(sale)}
   if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)return route.abort();data={sale};
  }
  if(url.pathname==='/api/sales/reconciliation'){if(reconcileUnavailable)return route.fulfill({status:503,json:{ok:false,error:{code:'API_ERROR'}}});data=sales.length?{state:'confirmed',sale:sales.at(-1)}:{state:'unknown'}}
  await route.fulfill({json:{ok:true,data}});
 });
 const start=performance.now();await page.goto(base+'/pos-pro');await expect(page.locator('.pp-product').first()).toBeEnabled();
 results.push({kind:'load',cartSize,catalogSize,width,ms:performance.now()-start});
 return {page,context,get sales(){return sales},get holds(){return holds},get posts(){return posts},set delay(ms){delay=ms},set fail(value){fail=value},set holdStatus(value){holdStatus=value},set barcodeDelay(value){barcodeDelay=value},set searchDelay(value){searchDelay=value},set reconcileUnavailable(value){reconcileUnavailable=value},set rejectStatus(value){rejectStatus=value}};
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
 if(uxOnly==='shift-conflicts'){
  const out='../artifacts/shift-conflicts';await mkdir(out,{recursive:true});
  for(const otherShiftCashier of ['owner','different-cashier']){
   const r=await setup({closed:true,otherShiftCashier,cartSize:otherShiftCashier==='owner'?1:0}),p=r.page;let writes=0;p.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/shifts/'))writes++});
   if(otherShiftCashier==='owner'){
    await expect(p.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();await expect(p.locator('.pp-shift-gate')).toContainText('2-Filialdagi smenangiz ochiq');await expect(p.getByRole('button',{name:'Smenani ochish',exact:true})).toHaveCount(0);await p.screenshot({path:`${out}/preflight-warning.png`,fullPage:true});
    await p.getByRole('button',{name:'Ochiq smenaga o‘tish',exact:true}).click();await p.getByRole('button',{name:'Davom etish',exact:true}).click();await expect(p).toHaveURL(/\/pos-pro$/);await expect(p.locator('.pp-cart-line')).toHaveCount(1);
    await p.getByRole('button',{name:'Ochiq smenaga o‘tish',exact:true}).click();await p.getByRole('button',{name:'O‘zgarishsiz chiqish',exact:true}).click();await expect(p).toHaveURL(/\/shifts$/);await expect(p.locator('.pro-page')).toContainText('2-Filial');
    assert.equal(await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).cart.length,`${posDraftKey(org,'owner',store)}:pro`),1);
   }
   else await expect(p.getByRole('button',{name:'Smenani ochish',exact:true})).toBeEnabled();
   assert.equal(writes,0);await p.screenshot({path:`${out}/preflight-${otherShiftCashier}.png`,fullPage:true});await r.context.close();
  }
  {
   const r=await setup({closed:true,otherShiftCashier:'owner',appRole:'CASHIER'}),p=r.page;let writes=0;p.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/shifts/'))writes++});
   await expect(p.locator('.pp-shift-gate')).toContainText('Administratorga murojaat qiling');await expect(p.getByRole('button',{name:'Ochiq smenaga o‘tish',exact:true})).toHaveCount(0);await expect(p.getByRole('button',{name:'Smenani ochish',exact:true})).toBeDisabled();assert.equal(writes,0);await r.context.close();
  }
  for(const [shiftConflict,text] of [['SHIFT_ALREADY_OPEN','joriy filialdagi ochiq smenani'],['EMPLOYEE_SHIFT_ALREADY_OPEN','Boshqa filialdagi smenangiz']]){
   const r=await setup({closed:true,shiftConflict}),p=r.page;let attempts=0;p.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/shifts/open')attempts++});
   await p.getByRole('button',{name:'Smenani ochish',exact:true}).click();await p.getByLabel('Boshlang‘ich naqd',{exact:true}).fill('0');await p.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();
   await expect(p.getByRole('dialog').getByRole('alert')).toContainText(text);await expect(p.locator('.pp-checkout')).toBeDisabled();assert.equal(attempts,1);assert.equal(r.posts,0);await expect(p.getByRole('dialog')).not.toContainText('internal-private-detail');await p.screenshot({path:`${out}/${shiftConflict}.png`,fullPage:true});await r.context.close();
  }
 }
 if(uxOnly==='control-alignment'){
  const out='../artifacts/pos-pro-control-alignment';await mkdir(out,{recursive:true});
  for(const touch of [false,true])for(const width of [1366,1024,390,320]){
   const r=await setup({width,height:768,cartSize:1,touch}),p=r.page;
   if(touch){await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Touch POS',exact:true}).click()}
   for(const theme of ['light','dark']){
    if(theme==='dark')await p.getByLabel('Mavzu',{exact:true}).click();
    const line=p.locator('.pp-cart-line').first();await line.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const m=await line.evaluate(el=>{const field=s=>{const e=el.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {top:r.top,height:r.height,font:c.fontSize}};return {quantity:field('.pp-quantity input'),discount:field('.pp-line-discount input')}});
    await line.screenshot({path:`${out}/${process.env.POS_CONTROL_PHASE||'after'}-${touch?'touch':'classic'}-${width}-${theme}.png`});results.push({kind:'control-alignment',touch,width,theme,...m});
    if(process.env.POS_CONTROL_PHASE!=='before'){assert.ok(Math.abs(m.quantity.top-m.discount.top)<1,JSON.stringify(m));assert.equal(m.quantity.height,m.discount.height);assert.equal(m.quantity.font,m.discount.font)}
   }
   await r.context.close();
  }
 }
 if(uxOnly==='deep-targeted'){
  const evidence=[];
  for(const width of [1024,1366]){
   const closed=width===1366,r=await setup({width,height:768,cartSize:6,touch:true,closed,stress:true}),p=r.page;
   await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Touch POS',exact:true}).click();await expect(p.locator('.pp-cart-line')).toHaveCount(6);
   for(const theme of ['light','dark']){
    if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const geometry=await p.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};return {viewport:{width:innerWidth,height:innerHeight},body:rect(document.querySelector('.pp-terminal-body')),terminal:rect(document.querySelector('.pp-terminal')),cta:rect(document.querySelector('.pp-checkout')),keypad:rect(document.querySelector('.pp-touch-keypad')),payments:[...document.querySelectorAll('.pp-payments button')].map(rect)}});
    evidence.push({width,closed,theme,...geometry});await p.screenshot({path:`${output}/touch-${width}-${theme}-6-${closed?'closed':'open'}.png`,fullPage:true});
    for(const control of [geometry.cta,geometry.keypad])assert.ok(control.top>=0&&control.bottom<=768+1,`Touch${width} ${theme} keypad/CTA clipped`);
    assert.ok(geometry.payments.every(r=>r.top>=geometry.body.top-1&&r.bottom<=Math.min(768,geometry.body.bottom)+1),`Touch${width} ${theme} payment clipping`);
    if(closed)await expect(p.locator('.pp-checkout')).toBeDisabled();else await expect(p.locator('.pp-checkout')).toBeEnabled();
   }
   await r.context.close();
  }
  await writeFile(output+'/targeted-measurements.json',JSON.stringify(evidence,null,2));results.push({kind:'deep-targeted',states:evidence.length,passed:true});
 }
 if(uxOnly==='focus-diagnostic'){
  const evidence=[];
  const sample=page=>page.locator('.pp-barcode').evaluate(el=>{const s=getComputedStyle(el),rules=[];const scan=(list,sheet)=>{for(const r of list){if(r.selectorText){try{if(el.matches(r.selectorText)&&r.style.cssText.includes('outline'))rules.push({selector:r.selectorText,css:r.style.cssText,sheet})}catch{}}if(r.cssRules)scan(r.cssRules,sheet)}};for(const sheet of document.styleSheets){try{scan(sheet.cssRules,sheet.href)}catch{}}return {outline:s.outline,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,offset:s.outlineOffset,primary:s.getPropertyValue('--primary'),active:document.activeElement.outerHTML,within:el.matches(':focus-within'),rules,inline:el.style.cssText,sheets:[...document.styleSheets].map(s=>s.href)}});
  for(const touch of [false,true])for(const width of [320,1366,1920]){
   const r=await setup({width,height:width===320?700:768,cartSize:20,touch,stress:true,longName:'Tabiiy sutli shokolad va yong‘oqli supermarket mahsuloti katta oilalar uchun'}),p=r.page;
   if(touch){await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Touch POS',exact:true}).click()}
   for(const theme of ['light','dark']){
    if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();
    for(const method of ['focus','F3']){
     if(method==='focus')await p.getByLabel('Barcode',{exact:true}).focus();else{await p.getByLabel('Barcode',{exact:true}).blur();await p.keyboard.press('F3');await expect(p.getByLabel('Barcode',{exact:true})).toBeFocused()}
     const immediate=await sample(p);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const settled=await sample(p);
     let afterScreenshot=null;if(method==='F3'){await p.screenshot();afterScreenshot=await sample(p);await p.locator('.pp-cart-line').last().scrollIntoViewIfNeeded();await p.locator('.pp-product').last().scrollIntoViewIfNeeded()}
     evidence.push({touch,width,theme,method,immediate,settled,afterScreenshot});
    }
   }
   await r.context.close();
  }
  await mkdir('../artifacts/pos-pro-deep',{recursive:true});await writeFile('../artifacts/pos-pro-deep/focus-diagnostic.json',JSON.stringify(evidence,null,2));results.push({kind:'focus-diagnostic',samples:evidence.length,unexpected:evidence.filter(x=>x.immediate.outlineWidth!=='2px'||x.settled.outlineWidth!=='2px')});
 }
 if(uxOnly==='deep-visual'){
  const measurements=[],failures=[],after=process.env.POS_DEEP_PHASE==='after',before=after?JSON.parse(await readFile('../artifacts/pos-pro-deep/before/measurements.json','utf8')):[],dimensions=[[1024,768],[1366,768],[1600,900],[1920,1080],[320,700],[360,800],[390,844],[430,932],[768,1024],[820,1180]];
  const check=(ok,message)=>{if(after&&!ok)failures.push(message)};
  const paymentBounds=page=>page.evaluate(()=>{const panel=document.querySelector('.pp-terminal-body').getBoundingClientRect(),terminal=document.querySelector('.pp-terminal').getBoundingClientRect(),cta=document.querySelector('.pp-checkout').getBoundingClientRect();return [...document.querySelectorAll('.pp-payments button')].every(e=>{const r=e.getBoundingClientRect();return r.top>=panel.top-1&&r.bottom<=Math.min(innerHeight,panel.bottom)+1})&&cta.top>=terminal.top-1&&cta.bottom<=Math.min(innerHeight,terminal.bottom)+1});
  for(const touch of [false,true])for(let i=0;i<dimensions.length;i++){
   const [width,height]=dimensions[i],cartSize=[0,1,6,20,100,500][i%6],r=await setup({width,height,cartSize,touch,stress:true,longName:'Tabiiy sutli shokolad va yong‘oqli supermarket mahsuloti katta oilalar uchun'}),p=r.page;
   if(touch){await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Touch POS',exact:true}).click()}
   await expect(p.locator('.pp-cart-line')).toHaveCount(cartSize);
   const notice=p.getByRole('button',{name:'Tushunarli',exact:true});if(await notice.isVisible())await notice.click();
   for(const theme of ['light','dark']){
    if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();
    await p.evaluate(()=>{document.querySelectorAll('.pp-cart-lines,.pp-products,.pp-terminal-body').forEach(e=>e.scrollTop=0);scrollTo(0,0)});
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await p.getByLabel('Barcode',{exact:true}).focus();await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const m=await p.evaluate(()=>{const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const style=e=>{if(!e)return null;const s=getComputedStyle(e);return {color:s.color,fontSize:s.fontSize,outline:s.outline,outlineOffset:s.outlineOffset,boxShadow:s.boxShadow}};const barcode=document.querySelector('input[aria-label="Barcode"]');return {overflow:document.documentElement.scrollWidth>innerWidth+1,barcodeFocus:style(barcode),barcodeFormFocus:style(barcode.closest('form')),geometry:Object.fromEntries(['.pp-cart-heading','.pp-line-name','.pp-quantity input','.pp-line-discount input','.pp-line-total','.pp-checkout','.pp-terminal-body'].map(s=>[s,rect(document.querySelector(s))])),payments:[...document.querySelectorAll('.pp-payments button')].map(rect),controls:[...document.querySelectorAll('.pp-cart-line button,.pp-header-actions button')].map(e=>({label:e.getAttribute('aria-label')||e.textContent,...rect(e)})),metadata:['.pp-line-name small','.pp-product small','.pp-footer'].map(s=>({selector:s,...style(document.querySelector(s))}))}});
    await p.getByLabel('POS Pro qidiruv').focus();m.searchFocus=await p.getByLabel('POS Pro qidiruv').evaluate(e=>{const s=getComputedStyle(e);return {outline:s.outline,offset:s.outlineOffset,shadow:s.boxShadow}});
    await p.getByLabel('Barcode',{exact:true}).focus();await p.evaluate(()=>{document.querySelectorAll('.pp-cart-lines,.pp-products,.pp-terminal-body').forEach(e=>e.scrollTop=0);scrollTo(0,0)});
    const key=`${touch?'touch':'classic'}-${width}-${theme}-${cartSize}`;await p.screenshot({path:`${output}/${key}.png`,fullPage:true});
    check(!m.overflow,key+' horizontal overflow');check(m.controls.filter(c=>c.label.endsWith('olib tashlash')).every(c=>c.width>=44&&c.height>=44),key+' remove target under44');
    if(!touch&&width>1100)check(await paymentBounds(p),key+' payment/CTA panel clipping');
    if(touch&&[1024,1366].includes(width))check(await p.evaluate(()=>['.pp-touch-keypad','.pp-checkout'].every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1})),key+' keypad/CTA outside viewport');
    if(width===320&&cartSize){const prior=before.find(x=>x.key===key);if(prior)check(m.geometry['.pp-line-total'].height<prior.geometry['.pp-line-total'].height,key+' amount height not improved')}
    for(const [name,selector]of [['cart','.pp-cart-line'],['catalog','.pp-product']]){const last=p.locator(selector).last();if(await last.count()){await last.evaluate(e=>{const panel=e.closest('.pp-cart-lines,.pp-products');panel.scrollTop=panel.scrollHeight});await last.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));m[name+'Last']=await last.evaluate(e=>{const r=e.getBoundingClientRect(),parent=e.closest('.pp-cart-lines,.pp-products').getBoundingClientRect();return {top:r.top,bottom:r.bottom,parentTop:parent.top,parentBottom:parent.bottom,height:r.height,parentHeight:parent.height,tallerThanPanel:r.height>parent.height,fullyVisible:r.top>=Math.max(0,parent.top)-1&&r.bottom<=Math.min(innerHeight,parent.bottom)+1}});if(name==='cart')check(m.cartLast.fullyVisible,key+' final cart row unreachable')}}
    measurements.push({key,width,height,cartSize,...m});
   }
   await r.context.close();
  }
  const closed=await setup({closed:true,cartSize:6,width:1366,height:768,stress:true});await expect(closed.page.locator('.pp-checkout')).toBeDisabled();await closed.page.screenshot({path:`${output}/classic-1366-light-6-closed.png`,fullPage:true});await closed.page.getByRole('button',{name:'Mavzu',exact:true}).click();await closed.page.screenshot({path:`${output}/classic-1366-dark-6-closed.png`,fullPage:true});await closed.context.close();
  if(after){
   const r=await setup({closed:true,cartSize:6,width:1366,height:768,stress:true}),p=r.page;check(await paymentBounds(p),'closed1366 billion payment/CTA clipping');await p.getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(p.getByRole('dialog')).toBeVisible();await p.screenshot({path:`${output}/shift-open-modal.png`,fullPage:true});await p.keyboard.press('Escape');await p.getByRole('button',{name:'Qurilmalar',exact:true}).click();await expect(p.getByRole('dialog')).toBeVisible();await p.screenshot({path:`${output}/devices-modal.png`,fullPage:true});await p.keyboard.press('Escape');await r.context.close();
   const active=await setup({cartSize:1}),q=active.page;await q.getByLabel('Barcode',{exact:true}).blur();await q.keyboard.press('F7');await expect(q.getByRole('dialog')).toBeVisible();await q.screenshot({path:`${output}/cash-modal.png`,fullPage:true});await q.keyboard.press('Escape');await q.keyboard.press('F6');await expect(q.getByRole('dialog')).toBeVisible();await q.screenshot({path:`${output}/holds-modal.png`,fullPage:true});await active.context.close();
  }
  await writeFile(output+'/measurements.json',JSON.stringify(measurements,null,2));results.push({kind:'deep-visual',states:measurements.length,overflow:measurements.filter(m=>m.overflow).map(m=>m.key),shiftClosedGuard:true,failures});assert.deepEqual(failures,[]);
 }
 if(!uxOnly||uxOnly==='touch-mode'){
  const out='../artifacts/touch-pos';await mkdir(out,{recursive:true});
  for(const [width,height]of [[1024,768],[1366,768],[1920,1080],[390,844],[320,700]]){
   const r=await setup({width,height,touch:true}),p=r.page;
   await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Touch POS',exact:true}).click();
   await expect(p.locator('.pp-touch')).toBeVisible();await p.locator('.pp-product').first().tap();
   await expect(p.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();
   const console=p.locator('.pp-touch-console');
   await console.getByLabel('Raqam 2',{exact:true}).tap();await console.getByLabel('Qiymatni qo‘llash',{exact:true}).tap();
   await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');
   await console.getByRole('button',{name:'Chegirma',exact:true}).tap();await console.getByLabel('Raqam 1',{exact:true}).tap();await console.getByLabel('Raqam 0',{exact:true}).tap();await console.getByLabel('Qiymatni qo‘llash',{exact:true}).tap();
   await expect(p.getByLabel('Olma chegirma',{exact:true})).toHaveValue('10');
   await console.getByRole('button',{name:'Narx',exact:true}).tap();for(const digit of ['1','0','2','0','0'])await console.getByLabel(`Raqam ${digit}`,{exact:true}).tap();await console.getByLabel('Qiymatni qo‘llash',{exact:true}).tap();
   await expect(p.getByLabel('Olma chegirma',{exact:true})).toHaveValue('15');
   await p.reload();await expect(p.locator('.pp-product').first()).toBeEnabled();await expect(p.locator('.pp-touch')).toBeVisible();await expect(p.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();
   await p.evaluate(()=>scrollTo(0,0));
   const geometry=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height}};return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,console:rect('.pp-touch-console'),keypad:rect('.pp-touch-keypad'),checkout:rect('.pp-checkout'),catalog:rect('.pp-products'),cart:rect('.pp-cart')}});
   results.push({kind:'touch-mode-geometry',...geometry});assert.ok(geometry.scrollWidth<=width+1,'touch horizontal overflow '+width);
   assert.ok(await p.locator('.pp-payments button').evaluateAll(buttons=>buttons.every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})), 'payment controls outside viewport '+width);
   if(width>900){assert.ok(geometry.catalog.height>=120,'catalog clipped '+width);assert.ok(geometry.keypad.bottom<=height,'keypad clipped '+width);assert.ok(geometry.checkout.bottom<=height,'checkout clipped '+width)}
   await p.screenshot({path:`${out}/${width}-light.png`,fullPage:true});await p.getByLabel('Mavzu',{exact:true}).click();await p.screenshot({path:`${out}/${width}-dark.png`,fullPage:true});
   await p.locator('.pp-checkout').click();await expect(p.getByRole('dialog')).toBeVisible();await p.keyboard.press('Escape');
   await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Classic POS Pro',exact:true}).click();await expect(p.locator('.pp-touch-console')).toHaveCount(0);await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');
   if(width===1366){
    await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Touch POS',exact:true}).click();
    for(const method of ['cash','card','transfer','split','credit']){const button=p.locator(`.pp-pay-${method}`);if(await button.count()){await button.click();await expect(p.getByRole('dialog')).toBeVisible();await p.keyboard.press('Escape')}}
    await p.keyboard.press('F5');await expect(p.locator('.pp-cart-line')).toHaveCount(0);await p.keyboard.press('F6');await p.locator('.pp-holds button').first().click();await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');
    await p.locator('.pp-checkout').click();await p.getByLabel('Mijoz bergan naqd',{exact:true}).fill('30000');await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();assert.equal(r.posts,1);assert.equal(r.sales[0].request.payments[0].amount,20400);assert.equal(r.sales[0].request.metadata.source,'pos-pro');
   }
   await r.context.close();
  }
  for(const closed of [false,true]){
   const r=await setup({width:1024,height:768,cartSize:closed?1:500,closed,touch:true}),p=r.page;await p.getByLabel('POS Pro rejimi',{exact:true}).click();await p.getByRole('option',{name:'Touch POS',exact:true}).click();await expect(p.locator('.pp-cart-line')).toHaveCount(closed?1:500);await p.locator('.pp-cart-line').last().scrollIntoViewIfNeeded();
   if(closed){await expect(p.locator('.pp-checkout')).toBeDisabled()}else{await p.locator('.pp-cart-line').last().click();await p.locator('.pp-touch-console').getByLabel('Raqam 2',{exact:true}).tap();await p.locator('.pp-touch-console').getByLabel('Qiymatni qo‘llash',{exact:true}).tap();await expect(p.getByLabel('Mahsulot 499 miqdori',{exact:true})).toHaveValue('2')}
   await p.screenshot({path:`${out}/1024-${closed?'closed':'500-lines'}.png`,fullPage:true});await r.context.close();
  }
 }
 if(uxOnly==='platform-contract'){
  const r=await setup({width:1366,height:768,closed:true}),p=r.page,failures=[];
  const measured=await p.evaluate(()=>{
   const total=getComputedStyle(document.querySelector('.pp-total')),panel=getComputedStyle(document.querySelector('.pp-terminal'));
   return {totalText:total.color,panelText:panel.color,totalAccentBorder:parseFloat(total.borderLeftWidth),disabledPaymentOpacity:getComputedStyle(document.querySelector('.pp-payments button')).opacity,shiftHeight:document.querySelector('.pp-shift-gate').getBoundingClientRect().height,paymentClipped:[...document.querySelectorAll('.pp-payments button')].some(el=>el.getBoundingClientRect().bottom>document.querySelector('.pp-terminal-body').getBoundingClientRect().bottom+1),terminalBottom:document.querySelector('.pp-terminal').getBoundingClientRect().bottom,checkoutBottom:document.querySelector('.pp-checkout').getBoundingClientRect().bottom};
  });
  if(measured.totalText!==measured.panelText)failures.push('total uses inverted colors instead of platform KPI text');
  if(measured.totalAccentBorder>1)failures.push('total has a heavy accent border');
  if(measured.disabledPaymentOpacity!=='1')failures.push('disabled payment labels fade as a whole');
  if(measured.paymentClipped)failures.push('closed-shift payment method clipped by body');
  if(measured.shiftHeight>76)failures.push('closed shift notice is too tall');
  if(measured.checkoutBottom>Math.min(768,measured.terminalBottom))failures.push('closed-shift checkout is outside viewport');
  await p.setViewportSize({width:390,height:844});
  await expect.poll(()=>p.locator('.pp-terminal').evaluate(el=>getComputedStyle(el).display)).toBe('flex');
  const mobile=await p.locator('.pp-terminal').evaluate(el=>{const c=getComputedStyle(el),inner=el.clientWidth-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight);return {inner,total:el.querySelector('.pp-total').getBoundingClientRect().width,cta:el.querySelector('.pp-checkout').getBoundingClientRect().width}});
  if(Math.abs(mobile.total-mobile.inner)>1||Math.abs(mobile.cta-mobile.inner)>1)failures.push('mobile total and checkout must span settlement width');
  console.log(JSON.stringify({measured,failures}));await r.context.close();assert.deepEqual(failures,[]);
 }
 if(uxOnly==='platform-reference'){
  const out='../artifacts/pos-pro-4/platform';await mkdir(out,{recursive:true});const tokens=[];
  const r=await setup({width:1600,height:900,presentation:true}),p=r.page;
  for(const theme of ['light','dark']){
   if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();
   for(const [name,path] of [['dashboard','/'],['sales','/sales'],['shifts','/shifts'],['products','/products'],['inventory','/inventory'],['analytics','/analytics'],['settings','/settings']]){
    await p.goto(base+path);await expect(p.locator('.main h1').first()).toBeVisible();await expect(p.locator('.page-skeleton')).toHaveCount(0);await expect(p.locator('.sidebar')).toBeVisible();await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:`${out}/${name}-${theme}.png`,fullPage:true});
    tokens.push({page:name,theme,values:await p.evaluate(()=>Object.fromEntries(['--bg','--card-bg','--surface','--soft-surface','--text','--muted','--border','--primary','--primary-dark','--radius-control','--radius-card','--radius-panel','--font-family'].map(k=>[k,getComputedStyle(document.body).getPropertyValue(k).trim()]))) });
   }
   await p.goto(base+'/pos-pro');await expect(p.locator('.pp-product').first()).toBeEnabled();
  }
  await writeFile(`${out}/tokens.json`,JSON.stringify(tokens,null,2));await r.context.close();
 }
 if(uxOnly==='pixel-accessibility'){
  const evidence=[];
  for(const [width,height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]]){
   const r=await setup({width,height,cartSize:20}),p=r.page;
   for(const theme of ['light','dark']){
    if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();
    await p.keyboard.press('F3');await expect(p.getByLabel('Barcode',{exact:true})).toBeFocused();await expect.poll(()=>p.locator('.pp-barcode').evaluate(el=>getComputedStyle(el).outlineWidth)).toBe('2px');
    assert.ok(await p.locator('.pp-quantity').first().evaluate(el=>{const h=[...el.querySelectorAll('button,input')].map(n=>n.getBoundingClientRect().height);return Math.max(...h)-Math.min(...h)<1}));
    const measureContrasts=()=>p.evaluate(()=>{
     const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=canvas.height=1;
     const color=s=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v)};
     const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
     const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
     return ['.pp-line-name strong','.pp-line-name small','.pp-totals-row span','.pp-total strong','.pp-checkout','.pp-product strong','.pp-product b','#pp-search-help','.pp-shift-status','.pp-barcode-label','.pp-payment-heading','.pp-line-discount','.pp-quantity small','.pp-header-actions button'].map(selector=>{
      const el=document.querySelector(selector),ancestors=[];for(let n=el;n;n=n.parentElement)ancestors.unshift(n);let bg=[255,255,255];for(const n of ancestors)bg=over(color(getComputedStyle(n).backgroundColor),bg);
      const fg=over(color(getComputedStyle(el).color),bg),a=luminance(fg),b=luminance(bg);return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
     });
    });
    let contrasts=await measureContrasts();
    if(contrasts.some(c=>c.ratio<4.5)){
      // Theme color transitions can cross through low-contrast intermediate frames.
      // Wait for the settled UI; retain the original strict WCAG 4.5:1 gate.
      try{
        await expect.poll(async()=>{
          contrasts=await measureContrasts();
          return contrasts.every(c=>c.ratio>=4.5);
        },{timeout:3000}).toBe(true);
      }catch{
        assert.fail(JSON.stringify({width,theme,contrasts}));
      }
    }
    assert.ok(contrasts.every(c=>c.ratio>=4.5),JSON.stringify({width,theme,contrasts}));evidence.push({width,theme,contrasts});
    await p.locator('.pp-cart-line').last().scrollIntoViewIfNeeded();assert.ok(await p.locator('.pp-cart-line').last().evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom+1}));
   }
   await r.context.close();
  }
  await writeFile('../artifacts/pos-pro-4/accessibility.json',JSON.stringify(evidence,null,2));
 }
 if(uxOnly==='pixel-states'){
  const out='../artifacts/pos-pro-4/after';await mkdir(out,{recursive:true});
  for(const [width,height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]]){
   const r=await setup({width,height,closed:true,cartSize:2}),p=r.page;
   for(const theme of ['light','dark']){if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();await expect(p.locator('.pp-checkout')).toBeDisabled();if(width>1100)assert.ok(await p.locator('.pp-checkout').evaluate(el=>{const r=el.getBoundingClientRect(),panel=el.closest('.pp-terminal').getBoundingClientRect();return r.bottom<=Math.min(innerHeight,panel.bottom)}));await p.screenshot({path:`${out}/${width}-${theme}-closed.png`,fullPage:true})}
   await p.getByRole('button',{name:'Smenani ochish',exact:true}).click();await p.getByLabel('Boshlang‘ich naqd',{exact:true}).fill('10000');await p.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();
   // Shift opening starts asynchronous draft reconciliation. Do not dispatch
   // product/Hold shortcuts against the preceding closed-shift render.
   await expect(p.getByRole('dialog')).toHaveCount(0);
   await expect(p.locator('.pp-shift-status')).toHaveText('Smena ochiq');
   await expect(p.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();
   await p.locator('.pp-product').first().click();
   await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');
   r.holdStatus=503;await p.keyboard.press('F5');await expect(p.locator('.pp-recovery')).toBeVisible();
   for(const theme of ['dark','light']){if(theme==='light')await p.getByRole('button',{name:'Mavzu',exact:true}).click();await expect(p.locator('.pp-checkout')).toBeDisabled();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${out}/${width}-${theme}-recovery.png`,fullPage:true})}
   r.holdStatus=0;await p.getByRole('button',{name:'Hold saqlashni qayta tekshirish',exact:true}).click();await expect(p.locator('.pp-cart-line')).toHaveCount(0);assert.equal(r.holds.length,1);await r.context.close();
  }
  for(const [width,height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]]){const r=await setup({width,height,stress:true,unit:'maxsus qadoq birligi',longName:'Uzoq nomli maxsus qadoqdagi mahsulot'}),p=r.page;
  await p.locator('.pp-product').first().click();await p.getByLabel('Uzoq nomli maxsus qadoqdagi mahsulot miqdori',{exact:true}).fill('1000');await p.getByLabel('Uzoq nomli maxsus qadoqdagi mahsulot miqdori',{exact:true}).press('Enter');
  await expect(p.locator('.pp-line-total')).toContainText('12,000,000');for(const theme of ['light','dark']){if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await p.locator('.pp-branch').evaluate(el=>el.querySelector('button').getBoundingClientRect().right<=el.getBoundingClientRect().right+1),'long branch selector must fit its track');await p.screenshot({path:`${out}/${width}-${theme}-custom-unit-large-total.png`,fullPage:true})}await r.context.close();}
 }
 if(uxOnly==='pixel'){
  const phase=process.env.POS_PRO_VISUAL_PHASE||'after',out=`../artifacts/pos-pro-4/${phase}`;
  await mkdir(out,{recursive:true});const measurements=[],failures=[];
  const check=(ok,message)=>{if(!ok)failures.push(message)};
  for(const [width,height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]])for(const cartSize of [0,1,2,5,20,100,500]){
   const r=await setup({width,height,cartSize,presentation:true,longName:'Tabiiy sutli shokolad va yong‘oqli supermarket mahsuloti katta oila uchun'}),p=r.page;
   await expect(p.locator('.pp-cart-line')).toHaveCount(cartSize);
   const notice=p.getByRole('button',{name:'Tushunarli',exact:true});if(await notice.isVisible())await notice.click();
   for(const theme of ['light','dark']){
    if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const m=await p.evaluate(()=>{
     const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
     const heading=[...document.querySelectorAll('.pp-cart-heading>span')].filter(el=>el.textContent.trim());
     const line=document.querySelector('.pp-cart-line'),controls=line?[line.querySelector('.pp-line-name'),line.querySelector('.pp-quantity input'),line.querySelector('.pp-line-discount input'),line.querySelector('.pp-line-total')].map(rect):[];
     return {overflow:document.documentElement.scrollWidth>innerWidth+1,heading:heading.map(rect),controls,buttons:[...document.querySelectorAll('.pp-payments button')].map(rect),checkout:rect(document.querySelector('.pp-checkout')),terminal:rect(document.querySelector('.pp-terminal')),terminalBody:rect(document.querySelector('.pp-terminal-body')),negativeZero:document.querySelector('.pp-totals-row:nth-child(2)').textContent.includes('−0'),catalogColumns:getComputedStyle(document.querySelector('.pp-products')).gridTemplateColumns.split(' ').length,cartOverflow:document.querySelector('.pp-cart-lines').scrollWidth>document.querySelector('.pp-cart-lines').clientWidth+1};
    });
    const key=`${width}-${theme}-${cartSize}`;measurements.push({key,...m});
    check(!m.overflow&&!m.cartOverflow,key+' horizontal overflow');check(!m.negativeZero,key+' negative zero');check(m.catalogColumns===2,key+' catalog columns');
    check(await p.locator('.pp-product').first().evaluate(el=>{
     const [name,price,meta]=[...el.children].map(n=>n.getBoundingClientRect());return name.bottom<=price.top+1&&price.bottom<=meta.top+1&&meta.bottom<=el.getBoundingClientRect().bottom;
    }),key+' catalog text overlap');
    check(await p.locator('.pp-products').evaluate(el=>{
     const cards=[...el.querySelectorAll('.pp-product')].map(n=>n.getBoundingClientRect());return cards.every((r,i)=>i<2||r.top>=cards[i-2].bottom-1)&&cards.every((r,i)=>i%2||!cards[i+1]||Math.abs(r.height-cards[i+1].height)<1);
    }),key+' catalog row overlap / heights');
    if(width>900&&cartSize){
     for(const i of [1,2])check(Math.abs(m.heading[i].x+m.heading[i].w/2-m.controls[i].x-m.controls[i].w/2)<=1,key+' column center '+i);
     check(Math.abs(m.heading[3].right-m.controls[3].right)<=1,key+' total edge');
    }
    if(width>1100)check(m.checkout.bottom<=Math.min(height,m.terminal.bottom)&&m.buttons.every(b=>b.bottom<=Math.min(height,m.terminal.bottom,m.terminalBody.bottom)+1),key+' payment viewport and panel clipping');
    check(m.buttons.every(b=>Math.abs(b.h-m.buttons[0].h)<1),key+' payment heights');
    if(cartSize===1||cartSize===2)check(await p.locator('.pp-sparse').evaluate(el=>el.querySelector('.pp-sparse-context').getBoundingClientRect().top>=el.getBoundingClientRect().top-1),key+' sparse content clipped above scroll origin');
    if([0,2,20].includes(cartSize))await p.screenshot({path:`${out}/${key}.png`,fullPage:true});
    if(phase==='after'&&cartSize===5){
     await p.keyboard.press('F7');await expect(p.getByRole('dialog')).toBeVisible();await p.screenshot({path:`${out}/${key}-modal.png`,fullPage:true});await p.keyboard.press('Escape');
     await p.getByRole('button',{name:'To‘liq ekran',exact:true}).click();await expect.poll(()=>p.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);await p.screenshot({path:`${out}/${key}-fullscreen.png`,fullPage:true});await p.getByRole('button',{name:'To‘liq ekrandan chiqish',exact:true}).click();await expect.poll(()=>p.evaluate(()=>Boolean(document.fullscreenElement))).toBe(false);
     await r.context.setOffline(true);await expect(p.locator('.pp-offline')).toBeVisible();await expect(p.locator('.pp-checkout')).toBeDisabled();await p.screenshot({path:`${out}/${key}-offline.png`,fullPage:true});await r.context.setOffline(false);
    }
   }
   await p.locator('.pp-products').evaluate(el=>el.scrollTop=el.scrollHeight);
   check(await p.locator('.pp-products').evaluate(el=>el.scrollTop+el.clientHeight>=el.scrollHeight-1),`${width}/${cartSize} catalog end`);
   await r.context.close();
  }
  await writeFile(`${out}/measurements.json`,JSON.stringify({measurements,failures},null,2));
  results.push({kind:'pixel',phase,cases:measurements.length,failures});
  if(phase!=='before')assert.deepEqual(failures,[]);
 }
 if(uxOnly==='scan-clock'){
  const r=await setup(),p=r.page;await p.getByRole('heading',{name:'Joriy chek',exact:true}).click();await simulateHid(p,['12345678'],180,0);await expect(p.locator('.pp-cart-line')).toHaveCount(0);await simulateHid(p,Array(10).fill('12345678'),6,50);await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('10');await r.context.close();
 }
 if(uxOnly==='polish'){
  const r=await setup({presentation:true}),p=r.page;await expect(p.locator('.pp-scan-status')).toContainText('Barcode kiritishga tayyor');await p.getByLabel('POS Pro qidiruv',{exact:true}).focus();await expect(p.locator('.pp-scan-status')).toContainText('F3');await p.keyboard.press('F3');await expect(p.locator('.pp-scan-status')).toContainText('Barcode kiritishga tayyor');
  await p.locator('.pp-product').first().click();await expect(p.locator('.pp-sparse')).toBeVisible();await p.locator('.pp-product').nth(1).click();await expect(p.locator('.pp-cart-line').nth(1).locator('.pp-quantity small')).toHaveText('dona');await expect(p.locator('.pp-product').nth(1)).toContainText('120 dona mavjud');await expect(p.locator('.pp-unit-price').first()).toHaveText('/ kg');await expect(p.locator('.pp-unit-price').nth(1)).toHaveText('/ dona');
  await p.locator('.pp-shortcuts summary').click();await expect(p.locator('.pp-shortcut-grid')).toBeVisible();await p.locator('.pp-shortcuts summary').click();await expect(p.locator('.pp-shortcut-grid')).not.toBeVisible();await p.setViewportSize({width:1600,height:900});assert.equal(await p.locator('.pp-products').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);await expect(p.locator('.pp-load-more')).toContainText('40');await p.keyboard.press('F3');await p.locator('.pp-products').evaluate(el=>el.scrollTop=0);await p.screenshot({path:'../artifacts/phase3-polish/sparse-light.png',fullPage:true});await p.locator('.pp-shortcuts summary').click();await p.screenshot({path:'../artifacts/phase3-polish/shortcut-help.png',fullPage:true});await r.context.close();
 }
 if(uxOnly==='tracking'){
  const r=await setup({serial:true}),p=r.page;await p.locator('.pp-product').first().click();await p.getByRole('button',{name:'Serial tanlang',exact:true}).click();await p.getByRole('dialog',{name:'Serial va partiya'}).getByLabel('S2',{exact:true}).check();await p.getByRole('button',{name:'Tanlovni saqlash',exact:true}).click();await p.keyboard.press('F7');await p.getByLabel('Mijoz bergan naqd',{exact:true}).fill('12000');await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();assert.equal(r.sales[0].request.items[0].metadata.tracking.serials[0].id,'s2');await r.context.close();
  const pending=await setup(),q=pending.page;pending.barcodeDelay=800;await q.getByLabel('Barcode',{exact:true}).fill('12345678');await q.getByLabel('Barcode',{exact:true}).press('Enter');await expect(q.getByLabel('POS Pro filial',{exact:true})).toBeDisabled();await q.keyboard.press('F7');await q.keyboard.press('F5');await expect(q.getByLabel('Olma miqdori',{exact:true})).toHaveValue('1');assert.equal(pending.holds.length,0);await pending.context.close();
 }
 if(uxOnly==='premium'){
  const r=await setup({presentation:true}),p=r.page;
  await expect(p.locator('.sidebar')).toHaveCount(0);await expect(p.locator('.header')).toHaveCount(0);await expect(p.getByLabel('Barcode',{exact:true})).toBeFocused();
  const second=await r.context.newPage();await second.goto(base+'/pos-pro');await expect(second.locator('.pp-lease')).toContainText('POS boshqa oynada ochiq');await expect(second.locator('.pp-cart-line')).toHaveCount(0);await p.close();await second.getByRole('button',{name:'Qayta tekshirish',exact:true}).click();await expect(second.locator('.pp-product').first()).toBeEnabled();
  await second.getByRole('button',{name:'Platformaga qaytish',exact:true}).click();await expect(second.locator('.sidebar')).toBeVisible();const popupPromise=second.waitForEvent('popup');await second.getByRole('link',{name:'⚡ POS Pro',exact:true}).first().click();const popup=await popupPromise;await expect(popup.locator('.pp-product').first()).toBeEnabled();await expect(popup.locator('.sidebar')).toHaveCount(0);assert.equal(await popup.evaluate(()=>window.opener),null);await popup.screenshot({path:'../artifacts/phase3/standalone-window.png',fullPage:true});await popup.locator('.pp-product').first().click();await popup.evaluate(()=>window.posContinuity='retained');await second.getByRole('link',{name:'⚡ POS Pro',exact:true}).first().click();assert.equal(await popup.evaluate(()=>window.posContinuity),'retained');await expect(popup.locator('.pp-cart-line')).toHaveCount(1);await popup.close();
  await second.evaluate(()=>window.open=()=>null);await second.getByRole('link',{name:'⚡ POS Pro',exact:true}).first().click();await expect(second).toHaveURL(/pos-pro/);await expect(second.locator('.pp-product').first()).toBeEnabled();
  await second.getByRole('button',{name:'To‘liq ekran',exact:true}).click();await expect(second.locator('.pp-kiosk')).toHaveCount(1);assert.equal(await second.evaluate(()=>Boolean(document.fullscreenElement)),true);await second.screenshot({path:'../artifacts/phase3/fullscreen.png'});await second.keyboard.press('Escape');await expect(second.locator('.pp-kiosk')).toHaveCount(0);
  for(let i=0;i<5;i++)await second.locator('.pp-product').nth(i).click();await expect(second.locator('.pp-cart-line')).toHaveCount(5);for(const [name,qty]of [['Olma','0.75'],['Tuxum','2'],['Guruch','500'],['Sut','1.5'],['Ichimlik suvi','750']]){const field=second.getByLabel(name+' miqdori',{exact:true});await field.fill(qty);await field.press('Enter')}await second.keyboard.press('F3');await second.locator('.pp-products').evaluate(el=>el.scrollTop=0);
  for(const [width,height]of [[1920,1080],[1600,900],[1440,900],[1366,768],[1024,768],[680,900],[390,844]]){await second.setViewportSize({width,height});for(const theme of ['light','dark']){await second.evaluate(theme=>{localStorage.setItem('zenix:theme:v1:owner',theme);window.dispatchEvent(new StorageEvent('storage',{key:'zenix:theme:v1:owner'}))},theme);await expect(second.locator('body')).toHaveClass(theme==='dark'?/dark-mode/:/^(?!.*dark-mode)/);assert.ok(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width+theme);if(width===390)assert.ok(await second.locator('.pp-products').evaluate(el=>el.clientHeight>=200),'phone catalog must remain browsable');if(width>=1366){await expect.poll(()=>second.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),{message:'desktop has no outer scroll at '+width+theme}).toBe(true);assert.ok(await second.locator('.pp-pay-credit').evaluate(el=>{const a=el.getBoundingClientRect(),p=el.closest('.pp-terminal-body').getBoundingClientRect();return a.top>=p.top&&a.bottom<=p.bottom}),'all payment methods visible')}await second.screenshot({path:'../artifacts/phase3/'+width+'-'+theme+'.png',fullPage:true})}}
  await second.getByRole('button',{name:'Platformaga qaytish',exact:true}).click();await expect(second.getByRole('dialog')).toBeVisible();await second.keyboard.press('Escape');await expect(second).toHaveURL(/pos-pro/);await expect(second.locator('.pp-cart-line')).toHaveCount(5);
  await r.context.close();
  const closed=await setup({closed:true,cartSize:2}),q=closed.page;await expect(q.locator('.pp-shift-gate')).toContainText('Draft');await expect(q.getByRole('button',{name:'Naqd to‘lov F12',exact:true})).toBeDisabled();await q.getByRole('button',{name:'Smenani ochish',exact:true}).click();await q.getByLabel('Boshlang‘ich naqd',{exact:true}).fill('10000');await q.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(q.locator('.pp-shift-gate')).toHaveCount(0);await expect(q.getByLabel('Olma miqdori',{exact:true})).toBeEnabled();await expect(q.locator('.pp-cart-line')).toHaveCount(2);await closed.context.close();
 }
 if(uxOnly==='workspace'){
  const r=await setup(),p=r.page;await expect(p.locator('.sidebar')).toHaveCount(0);await expect(p.locator('.app-header')).toHaveCount(0);await expect(p.getByLabel('Barcode',{exact:true})).toBeFocused();await expect(p.getByRole('button',{name:'Platformaga qaytish',exact:true})).toBeVisible();await r.context.close();
 }
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
  for(const [width,height]of [[1366,768],[1920,1080],[1024,768],[680,900],[390,844]]){const r=await setup({width,height,longName:'Long supermarket product name '.repeat(12)}),p=r.page;await p.locator('.pp-product').first().click();await expect(p.locator('.pp-cart-line')).toHaveCount(1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'long name overflow '+width);await r.context.close()}
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
 if(!uxOnly||uxOnly==='payment-rejection'){
  const r=await setup(),p=r.page;await p.locator('.pp-product').first().click();await p.keyboard.press('F7');
  const dialog=p.getByRole('dialog',{name:'To‘lov — Naqd'}),amount=p.getByLabel('Mijoz bergan naqd',{exact:true});
  await amount.fill('15000');await dialog.getByRole('checkbox').check();
  r.rejectStatus=422;await dialog.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.pp-error')).toContainText('yetarli emas');
  await expect(amount).toHaveValue('15000');
  await expect(p.locator('.pp-recovery')).toHaveCount(0);
  assert.equal(r.sales.length,0,'definite rejection must not create sale');
  r.rejectStatus=0;await dialog.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();
  await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();
  assert.equal(r.sales.length,1);
  assert.equal(r.posts,2,'one rejected and one accepted POST');
  await r.context.close();
 }
 if(!uxOnly||uxOnly==='payment-rejection'){
  const r=await setup(),p=r.page;await p.locator('.pp-product').first().click();await p.keyboard.press('F9');
  const dialog=p.getByRole('dialog',{name:'To‘lov — Aralash'}),cash=p.getByLabel('Mijoz bergan naqd',{exact:true});
  const card=p.getByLabel('Karta summasi',{exact:true});
  await card.fill('2000');await cash.fill('15000');await dialog.getByRole('checkbox').nth(0).check();await dialog.getByRole('checkbox').nth(1).check();
  r.rejectStatus=422;await dialog.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();
  await expect(dialog).toBeVisible();await expect(dialog.locator('.pp-error')).toContainText('yetarli emas');
  await expect(card).toHaveValue('2000');await expect(cash).toHaveValue('15000');
  assert.equal(r.sales.length,0);
  r.rejectStatus=0;await dialog.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();
  await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();
  assert.equal(r.sales.length,1);assert.equal(r.posts,2);
  assert.equal(r.sales[0].request.payments.find(row=>row.method==='card')?.amount,2000);
  await r.context.close();
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
 await expect(p.locator('.pp-top .pp-brand')).toBeVisible();await expect(p.locator('.sidebar')).toHaveCount(0);
 await p.getByRole('heading',{name:'Joriy chek',exact:true}).click();
 const start=performance.now();await simulateHid(p,Array(10).fill('12345678'),6,6);await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('10');results.push({kind:'ten-HID-scans',ms:performance.now()-start});
 await p.getByLabel('Barcode',{exact:true}).fill('99999999');await p.getByLabel('Barcode',{exact:true}).press('Enter');await expect(p.locator('.pp-error').first()).toBeVisible();assert.equal(await p.locator('.pp-cart-line').count(),1);
 await p.keyboard.press('F3');await expect(p.getByLabel('Barcode',{exact:true})).toBeFocused();
 await p.getByLabel('Barcode',{exact:true}).fill('unknown');await p.getByLabel('Barcode',{exact:true}).press('Enter');await expect(p.locator('.pp-error').first()).toContainText('topilmadi');
 await p.keyboard.press('F5');await expect(p.locator('.pp-cart-line')).toHaveCount(0);await p.keyboard.press('F6');await p.locator('.pp-holds button').first().click();await expect(p.getByLabel('Olma miqdori',{exact:true})).toHaveValue('10');
 await p.keyboard.press('F7');await expect(p.getByRole('dialog',{name:'To‘lov — Naqd'})).toBeVisible();await p.getByLabel('Mijoz bergan naqd',{exact:true}).fill('150000');await expect(p.locator('.pp-change')).toContainText('30');
 await p.getByRole('checkbox').check();s.delay=400;await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).dblclick({delay:20});await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();assert.equal(s.posts,1);assert.equal(s.sales[0].request.metadata.source,'pos-pro');assert.equal(s.sales[0].request.payments[0].amount,120000);
 await expect(p.frameLocator('.pp-receipt-preview').locator('body')).toContainText('Olma');await p.keyboard.press('F10');await expect(p.locator('iframe[title="POS Pro chek"]')).toHaveCount(1);await expect(p.frameLocator('iframe[title="POS Pro chek"]').locator('html')).toHaveAttribute('data-print-invoked','true');await p.locator('iframe[title="POS Pro chek"]').evaluate(el=>el.remove());await p.getByRole('button',{name:'Yangi chek',exact:true}).click();
 await p.locator('.pp-product').first().click();await p.keyboard.press('F8');await expect(p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true})).toBeDisabled();
 await p.getByText('Bank terminali / o‘tkazma muvaffaqiyatini tekshirdim.',{exact:false}).click();await p.getByText('Chek va to‘lov summasini tekshirdim.',{exact:false}).click();s.fail=true;await p.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();await expect(p.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();assert.equal(s.sales.length,2);assert.equal(s.sales[1].request.metadata.externalPaymentConfirmation,'manual-confirmed');
 await p.getByRole('button',{name:'Yangi chek',exact:true}).click();await p.getByRole('button',{name:'To‘liq ekran',exact:true}).click();await expect(p.locator('.pp-kiosk')).toBeVisible();await p.keyboard.press('Escape');await expect(p.locator('.pp-kiosk')).toHaveCount(0);
 await p.screenshot({path:output+'/desktop-1366.png',fullPage:true});await s.context.close();
 for(const [width,height] of [[1920,1080],[1024,768],[680,900],[390,844]]){
  const r=await setup({width,height,oldBackend:width===390});await r.page.locator('.pp-product').first().click();assert.ok(await r.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`horizontal overflow at ${width}`);await r.page.screenshot({path:`${output}/layout-${width}.png`,fullPage:true});await r.context.close();
 }
 for(const cartSize of [100,500]){
  const r=await setup({cartSize,catalogSize:50000});await expect(r.page.locator('.pp-cart-line')).toHaveCount(cartSize);
  const start=performance.now();await r.page.getByLabel('Olma miqdori',{exact:true}).fill('2');await r.page.getByLabel('Olma miqdori',{exact:true}).press('Enter');await expect(r.page.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');results.push({kind:'cart-edit',cartSize,ms:performance.now()-start});
  await r.page.reload();await expect(r.page.getByLabel('Olma miqdori',{exact:true})).toHaveValue('2');
  const t=performance.now();await r.page.getByLabel('POS Pro qidiruv').fill('last');await expect(r.page.locator('.pp-product').first()).toContainText('49999');results.push({kind:'50k-tail-search',cartSize,ms:performance.now()-t,renderedProducts:await r.page.locator('.pp-product').count()});await r.context.close();
 }
 const closed=await setup({closed:true});await closed.page.locator('.pp-product').first().click();await expect(closed.page.getByRole('button',{name:'Naqd to‘lov F12'})).toBeDisabled();await closed.context.close();
 }
 }
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors,scope:'Synthetic API browser workflows; not physical hardware or database load'},null,2));
}finally{await writeFile(output+`/${process.env.POS_PRO_SEARCH_BENCHMARK?'search-benchmark-'+process.env.POS_PRO_SEARCH_BENCHMARK:'browser-results'}.json`,JSON.stringify({results,errors},null,2));await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
