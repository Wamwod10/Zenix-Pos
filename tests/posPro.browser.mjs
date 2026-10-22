// Browser workflow and latency evidence with synthetic APIs. No hardware/bank/production claims.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {posDraftKey} from '../src/utils/posDraft.js';
import {simulateHid} from './helpers/posHid.mjs';
import {ean13CheckDigit} from '../src/pages/posPro/hardware.js';
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'}),base=`http://127.0.0.1:${server.httpServer.address().port}`;
const store='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',shift='33333333-3333-4333-8333-333333333333';
const product=i=>({id:`44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`,name:i?'Mahsulot '+i:'Olma',sku:'SKU-'+i,barcode:i?String(10000000+i):'12345678',unit:'kg',sellPrice:12000,stockByStore:{[store]:1000},archived:false});
const errors=[],results=[],output='../artifacts/phase2';await mkdir(output,{recursive:true});await mkdir('../artifacts/phase3-polish',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
async function setup({cartSize=0,catalogSize=10000,width=1366,height=768,closed=false,oldBackend=false,unit='kg',touch=false,longName='',serial=false,presentation=false,stress=false}={}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();let sales=[],holds=[],posts=0,delay=0,fail=false,holdStatus=0,barcodeDelay=0,searchDelay=0,reconcileUnavailable=false;
 await page.addInitScript(()=>{window.print=()=>{document.documentElement.dataset.printInvoked='true'}});
 page.on('pageerror',e=>errors.push(e.message));
 if(cartSize)await page.addInitScript(({key,cart})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({v:1,cart,cartDiscountPct:0,checkoutReference:'PRO-browser-stable'}))},{key:`${posDraftKey(org,'owner',store)}:pro`,cart:Array.from({length:cartSize},(_,i)=>({...product(i),cartQty:1,discountPercent:0}))});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
  let data={users:[],sessions:[],revision:'1',holds:[]};
  if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:org,appRole:'OWNER',name:stress?'Juda uzoq ism va familiyali supermarket kassiri':'Test kassir'}};
  if(url.pathname==='/api/bootstrap')data={catalogComplete:false,stores:[{id:store,name:stress?'Supermarketning juda uzoq nomli markaziy filiali':'Asosiy filial',active:true}],inventory:[],suppliers:[],activeShifts:closed?{}:{[store]:{id:shift,storeId:store,status:'open'}},organization:{id:org,name:'Test market',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:2}};
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
  if(url.pathname==='/api/shifts/open'&&req.method()==='POST'){closed=false;data={shift:{id:shift,store_id:store,cashier_id:'owner',opening_cash:req.postDataJSON().openingCash,status:'open',opened_at:new Date().toISOString(),metadata:{}}}}
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
 if(uxOnly==='pixel-accessibility'){
  const evidence=[];
  for(const [width,height] of [[1920,1080],[1600,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]]){
   const r=await setup({width,height,cartSize:20}),p=r.page;
   for(const theme of ['light','dark']){
    if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();
    await p.keyboard.press('F3');await expect(p.getByLabel('Barcode',{exact:true})).toBeFocused();assert.equal(await p.locator('.pp-barcode').evaluate(el=>getComputedStyle(el).outlineWidth),'2px');
    assert.ok(await p.locator('.pp-quantity').first().evaluate(el=>{const h=[...el.querySelectorAll('button,input')].map(n=>n.getBoundingClientRect().height);return Math.max(...h)-Math.min(...h)<1}));
    const contrasts=await p.evaluate(()=>{
     const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=canvas.height=1;
     const color=s=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v)};
     const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
     const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
     return ['.pp-line-name strong','.pp-line-name small','.pp-totals-row span','.pp-total strong','.pp-checkout','.pp-product strong','.pp-product b','#pp-search-help'].map(selector=>{
      const el=document.querySelector(selector),ancestors=[];for(let n=el;n;n=n.parentElement)ancestors.unshift(n);let bg=[255,255,255];for(const n of ancestors)bg=over(color(getComputedStyle(n).backgroundColor),bg);
      const fg=over(color(getComputedStyle(el).color),bg),a=luminance(fg),b=luminance(bg);return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
     });
    });
    assert.ok(contrasts.every(c=>c.ratio>=4.5),JSON.stringify({width,theme,contrasts}));evidence.push({width,theme,contrasts});
    await p.locator('.pp-cart-line').last().scrollIntoViewIfNeeded();assert.ok(await p.locator('.pp-cart-line').last().evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom+1}));
   }
   await r.context.close();
  }
  await writeFile('../artifacts/pos-pro-32/accessibility.json',JSON.stringify(evidence,null,2));
 }
 if(uxOnly==='pixel-states'){
  const out='../artifacts/pos-pro-32/after';await mkdir(out,{recursive:true});
  for(const [width,height] of [[1920,1080],[1600,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]]){
   const r=await setup({width,height,closed:true}),p=r.page;
   for(const theme of ['light','dark']){if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();await expect(p.locator('.pp-checkout')).toBeDisabled();await p.screenshot({path:`${out}/${width}-${theme}-closed.png`,fullPage:true})}
   await p.getByRole('button',{name:'Smenani ochish',exact:true}).click();await p.getByLabel('Boshlang‘ich naqd',{exact:true}).fill('10000');await p.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();
   await p.locator('.pp-product').first().click();r.holdStatus=503;await p.keyboard.press('F5');await expect(p.locator('.pp-recovery')).toBeVisible();
   for(const theme of ['dark','light']){if(theme==='light')await p.getByRole('button',{name:'Mavzu',exact:true}).click();await expect(p.locator('.pp-checkout')).toBeDisabled();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${out}/${width}-${theme}-recovery.png`,fullPage:true})}
   r.holdStatus=0;await p.getByRole('button',{name:'Hold saqlashni qayta tekshirish',exact:true}).click();await expect(p.locator('.pp-cart-line')).toHaveCount(0);assert.equal(r.holds.length,1);await r.context.close();
  }
  for(const [width,height] of [[1920,1080],[1600,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]]){const r=await setup({width,height,stress:true,unit:'maxsus qadoq birligi',longName:'Uzoq nomli maxsus qadoqdagi mahsulot'}),p=r.page;
  await p.locator('.pp-product').first().click();await p.getByLabel('Uzoq nomli maxsus qadoqdagi mahsulot miqdori',{exact:true}).fill('1000');await p.getByLabel('Uzoq nomli maxsus qadoqdagi mahsulot miqdori',{exact:true}).press('Enter');
  await expect(p.locator('.pp-line-total')).toContainText('12,000,000');for(const theme of ['light','dark']){if(theme==='dark')await p.getByRole('button',{name:'Mavzu',exact:true}).click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await p.locator('.pp-branch').evaluate(el=>el.querySelector('button').getBoundingClientRect().right<=el.getBoundingClientRect().right+1),'long branch selector must fit its track');await p.screenshot({path:`${out}/${width}-${theme}-custom-unit-large-total.png`,fullPage:true})}await r.context.close();}
 }
 if(uxOnly==='pixel'){
  const phase=process.env.POS_PRO_VISUAL_PHASE||'after',out=`../artifacts/pos-pro-32/${phase}`;
  await mkdir(out,{recursive:true});const measurements=[],failures=[];
  const check=(ok,message)=>{if(!ok)failures.push(message)};
  for(const [width,height] of [[1920,1080],[1600,900],[1366,768],[1280,800],[1024,768],[680,900],[390,844]])for(const cartSize of [0,1,2,5,20,100,500]){
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
     return {overflow:document.documentElement.scrollWidth>innerWidth+1,heading:heading.map(rect),controls,buttons:[...document.querySelectorAll('.pp-payments button')].map(rect),checkout:rect(document.querySelector('.pp-checkout')),negativeZero:document.querySelector('.pp-totals-row:nth-child(2)').textContent.includes('−0'),catalogColumns:getComputedStyle(document.querySelector('.pp-products')).gridTemplateColumns.split(' ').length,cartOverflow:document.querySelector('.pp-cart-lines').scrollWidth>document.querySelector('.pp-cart-lines').clientWidth+1};
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
    if(width>1100)check(m.checkout.bottom<=height&&m.buttons.every(b=>b.bottom<=height),key+' payment viewport');
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
  for(const [width,height]of [[1920,1080],[1600,900],[1366,768],[1024,768],[680,900],[390,844]]){await second.setViewportSize({width,height});for(const theme of ['light','dark']){await second.evaluate(theme=>{localStorage.setItem('zenix:theme:v1:owner',theme);window.dispatchEvent(new StorageEvent('storage',{key:'zenix:theme:v1:owner'}))},theme);await expect(second.locator('body')).toHaveClass(theme==='dark'?/dark-mode/:/^(?!.*dark-mode)/);assert.ok(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width+theme);if(width===390)assert.ok(await second.locator('.pp-products').evaluate(el=>el.clientHeight>=200),'phone catalog must remain browsable');if(width>=1366){await expect.poll(()=>second.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),{message:'desktop has no outer scroll at '+width+theme}).toBe(true);assert.ok(await second.locator('.pp-pay-credit').evaluate(el=>{const a=el.getBoundingClientRect(),p=el.closest('.pp-terminal-body').getBoundingClientRect();return a.top>=p.top&&a.bottom<=p.bottom}),'all payment methods visible')}await second.screenshot({path:'../artifacts/phase3/'+width+'-'+theme+'.png',fullPage:true})}}
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
