// Synthetic, local-only visual audit. Never contacts production services.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {posDraftKey} from '../src/utils/posDraft.js';
const phase=process.env.VISUAL_PHASE||'before',out=`../artifacts/visual-fix-2026/${phase}`;
await mkdir(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'}),base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
const store='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222';
const results=[],errors=[],interactions=[];
const product=i=>({id:`44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`,name:i?'Mahsulot '+i:'Tabiiy sutli shokolad va yong‘oqli supermarket mahsuloti katta oila uchun',sku:'SKU-'+i,barcode:'1234567890123456789012345678901234567890',unit:'kg',sellPrice:12000,costPrice:5000,quantity:1000,stockByStore:{[store]:1000},archived:false});
const routes=['/','/sales','/pos-pro','/shifts','/products','/inventory','/suppliers','/customers','/history','/expenses','/analytics','/seller-analytics','/activity-log','/settings','/billing','/profile','/help','/login','/register','/reset-password','/platform','/?ai=open'];
const matrix=[[320,700],[360,780],[375,812],[390,844],[430,932],[600,800],[680,900],[700,900],[760,900],[768,1024],[820,1180],[900,600],[980,800],[1024,768],[1280,800],[1366,768],[1440,900],[1600,900],[1920,1080]];
try{
 for(const [width,height] of matrix.filter(([w])=>!process.env.VISUAL_WIDTHS||process.env.VISUAL_WIDTHS.split(',').includes(String(w)))){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<=900,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
  page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push({width,error:e.message}));
  if(process.env.VISUAL_SALES_CART)await page.addInitScript(({key,cart})=>localStorage.setItem(key,JSON.stringify({v:1,cart,cartDiscountPct:0,checkoutReference:'visual-synthetic-draft'})),{key:posDraftKey(org,'owner',store),cart:Array.from({length:60},(_,i)=>({...product(i),cartQty:1,discountPercent:0}))});
  let currentRoute='';
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
   let data={users:[],sessions:[],items:[],events:[],revision:'1',holds:[],total:0};
   if(url.pathname==='/api/auth/me'){
    if(['/login','/register','/reset-password'].includes(currentRoute))return route.fulfill({status:401,json:{ok:false,error:{code:'UNAUTHORIZED'}}});
    data={user:{id:'owner',organizationId:org,appRole:currentRoute==='/platform'?'PLATFORM_ADMIN':'OWNER',name:process.env.VISUAL_STRESS?'Juda uzoq ism va familiyali supermarket kassiri':'Test kassir'}};
   }
   if(url.pathname==='/api/bootstrap')data={catalogComplete:true,stores:[{id:store,name:process.env.VISUAL_STRESS?'Supermarketning juda uzoq nomli markaziy filiali':'Asosiy filial',active:true}],inventory:Array.from({length:process.env.VISUAL_SALES_CART?100:40},(_,i)=>product(i)),suppliers:[{id:'supplier',name:'Uzun nomli sintetik ta’minotchi korxonasi',balance:1234567890}],employees:[],activeShifts:{[store]:{id:'shift',storeId:store,status:'open'}},organization:{id:org,name:'Test market',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:3}};
   if(url.pathname==='/api/bootstrap/catalog')data={products:Array.from({length:process.env.VISUAL_SALES_CART?100:40},(_,i)=>product(i)),categories:['Oziq-ovqat'],hasMore:false,missingIds:[]};
   if(url.pathname==='/api/settings')data={selectedStoreId:store,workspaceSettings:{organization:{timezone:'Asia/Tashkent'}}};
   if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
   if(url.pathname==='/api/finance'&&process.env.VISUAL_STRESS){const dateISO=new Date().toISOString().slice(0,10);data={sales:Array.from({length:120},(_,i)=>({id:'sale-'+i,storeId:store,dateISO,businessDateISO:dateISO,time:'12:00',sellerId:'owner',sellerName:'Juda uzoq ismli sintetik sotuvchi',total:1234567890+i,paidAmount:1234567890+i,paymentMethod:'cash',payment:'cash',items:[{productId:product(0).id,name:product(0).name,quantity:1,price:1234567890+i,costPrice:5000,returnedQty:0}]})),returns:[],expenses:[{id:'expense',storeId:store,dateISO,amount:123456789,category:'Sintetik xarajat'}],pagination:{hasMore:false,offset:0,limit:500}}}
   if(url.pathname==='/api/customers')data={items:[{id:'customer',name:'Juda uzun ism va familiyali sintetik mijoz',balance:1234567890,tags:[],customerType:'REGULAR',loyaltyTier:'STANDARD',totalPurchases:0,saleCount:0}],total:1};
   if(url.pathname==='/api/customers/stats')data={totalCustomers:1,aging:{}};
   if(url.pathname==='/api/customers/tags')data={configured:[],existing:[]};
   if(url.pathname==='/api/billing/plans')data={plans:[]};
   if(url.pathname==='/api/billing/subscription')data={subscription:{planCode:'BUSINESS',status:'ACTIVE',limits:{stores:3}}};
   if(url.pathname==='/api/billing/limits')data={resources:{stores:{used:1,limit:3}}};
   if(url.pathname==='/api/sales/pos-pro/summary')data={shift:{id:'shift'},count:0,total:0,cash:0,card:0,recent:[],popular:[]};
   if(url.pathname==='/api/ai/status')data={enabled:true,writable:true,writesEnabled:false,limit:1000,remaining:1000,suggestions:[]};
   await route.fulfill({json:{ok:true,data}});
  });
  for(const route of routes){
   if(process.env.VISUAL_ROUTES&&!process.env.VISUAL_ROUTES.split(',').includes(route))continue;
   // Every viewport covers the core layouts; all modules also run at narrow and wide sizes.
   if(![320,390,768,1366].includes(width)&&!['/','/sales','/pos-pro','/inventory','/login'].includes(route))continue;
   currentRoute=route;
   try{
    await page.goto(base+route);assert.equal(new URL(page.url()).pathname,new URL(route,base).pathname,'requested route must render without redirect');await page.locator('h1:visible,.pp-brand:visible,form:visible,.pos-page-pro').first().waitFor();await page.waitForTimeout(350);
    if(route==='/pos-pro')await expect(page.locator('.pp-product').first()).toBeEnabled();
    if(route==='/')await expect(page.locator('.dashboard-chart svg text').first()).toBeVisible();
    for(const theme of [ 'light',...([320,390,768,1366].includes(width)?['dark']:[])]){
     await page.evaluate(theme=>document.body.classList.toggle('dark-mode',theme==='dark'),theme);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const measurement=await page.evaluate(()=>{
      const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
      const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
      const outside=[...document.querySelectorAll('main *, .pos-pro *, form *')].filter(el=>visible(el)&&!el.closest('svg, .sidebar, [role="listbox"]')).map(el=>({el,r:el.getBoundingClientRect()})).filter(({el,r})=>r.width&&r.height&&(r.left< -1||r.right>innerWidth+1)&&!el.closest('table,.recharts-wrapper')).map(({el,r})=>{let scrollContainer=null;for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement)if(/auto|scroll/.test(getComputedStyle(p).overflowX)&&p.scrollWidth>p.clientWidth){scrollContainer=p.className;break}return {tag:el.tagName,class:el.className,x:r.x,right:r.right,scrollContainer}});
      const axis=[...document.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value,.recharts-yAxis-tick-labels text')].map(el=>el.textContent);
      const launcher=document.querySelector('.zenix-ai-floating'),l=launcher&&visible(launcher)?launcher.getBoundingClientRect():null;
      const collisions=l?[...document.querySelectorAll('.pos-checkout input,.checkout-primary,.pos-customer-results, [role="dialog"]')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.left<l.right&&r.right>l.left&&r.top<l.bottom&&r.bottom>l.top}).map(el=>el.className):[];
      const hit=l?document.elementFromPoint(l.x+l.width/2,l.y+l.height/2)?.closest('button')===launcher:null;
      const zeroTicks=[...document.querySelectorAll('.dashboard-chart svg text')].filter(el=>el.textContent==='0k').length;
      const headerOverflow=[...document.querySelectorAll('.header button')].filter(visible).map(el=>rect(el)).filter(r=>r.x< -1||r.right>innerWidth+1);
      const headerText=[...document.querySelectorAll('.header-store strong,.profile-copy strong')].filter(visible).map(el=>({text:el.textContent,width:el.clientWidth,scrollWidth:el.scrollWidth}));
      return {outside,axis,zeroTicks,headerText,headerOverflow,collisions,launcherHit:hit,header:rect(document.querySelector('.pp-top')),checkout:rect(document.querySelector('.pp-checkout')),pulse:rect(document.querySelector('.zenix-pulse')),cart:rect(document.querySelector('.pp-cart')),catalog:rect(document.querySelector('.pp-catalog'))};
     });
     results.push({width,height,route,theme,url:new URL(page.url()).pathname,...measurement});
     if(process.env.VISUAL_CAPTURE_ALL||[320,390,768,1366].includes(width))if(!process.env.VISUAL_GEOMETRY_ONLY)await page.screenshot({path:`${out}/${width}-${route==='/'?'dashboard':route==='/?ai=open'?'ai':route.slice(1)}-${theme}.png`,fullPage:true});
    }
    if(process.env.VISUAL_INTERACTIONS){
     const check=async(name,fn)=>{try{const evidence=await fn();interactions.push({width,route,name,status:'PASS',evidence})}catch(e){interactions.push({width,route,name,status:'FAIL',error:e.message})}};
     const bounds=()=>page.evaluate(()=>[...document.querySelectorAll('[role="dialog"] button,[role="dialog"] input,[role="dialog"] .premium-select')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,x:r.x,right:r.right,bottom:r.bottom,width:r.width}}));
     if(route==='/settings')await check('settings employee modal validation and footer',async()=>{await page.getByRole('button',{name:/Xodimlar/}).filter({visible:true}).first().click();await page.getByRole('button',{name:/Xodim qo/}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Xodimni yaratish',exact:true}).click();const evidence=await bounds();if(evidence.some(r=>r.x<0||r.right>width+1))throw Error(JSON.stringify(evidence));await expect(page.locator('.pro-modal-footer button').last()).toBeInViewport();if(!process.env.VISUAL_GEOMETRY_ONLY)await page.screenshot({path:`${out}/${width}-settings-modal.png`,fullPage:true});await page.keyboard.press('Escape');return evidence});
     if(['/inventory','/analytics','/activity-log','/settings','/platform'].includes(route))await check('horizontal control groups reach their final action',async()=>page.evaluate(()=>{const evidence=[];for(const el of document.querySelectorAll('main *')){if(!el.getClientRects().length||!['auto','scroll'].includes(getComputedStyle(el).overflowX)||el.scrollWidth<=el.clientWidth+2)continue;const button=el.querySelector('button:last-child');if(!button)continue;el.scrollLeft=el.scrollWidth;const a=el.getBoundingClientRect(),b=button.getBoundingClientRect();if(b.right>a.right+1||b.left<a.left-1)throw Error('unreachable scroll control: '+el.className);evidence.push(el.className);el.scrollLeft=0}return evidence}));
     if(route==='/sales'&&process.env.VISUAL_SALES_CART)await check('60-line cart last row and checkout reachable',async()=>{const tab=page.getByRole('tab',{name:/Savat/});if(await tab.isVisible())await tab.click();await expect(page.locator('.cart-item')).toHaveCount(60);await page.locator('.cart-item').last().scrollIntoViewIfNeeded();await expect(page.locator('.cart-item').last()).toBeInViewport();await page.locator('.checkout-primary').scrollIntoViewIfNeeded();await expect(page.locator('.checkout-primary')).toBeInViewport();return {rows:60,checkout:await page.locator('.checkout-primary').boundingBox()}});
     if(route==='/pos-pro'){
      await check('catalog final card reachable',async()=>{await page.locator('.pp-product').last().scrollIntoViewIfNeeded();return page.locator('.pp-product').last().evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();if(r.bottom>p.bottom+1||r.top<p.top-1)throw Error(JSON.stringify({card:{top:r.top,bottom:r.bottom,height:r.height},panel:{top:p.top,bottom:p.bottom,height:p.height}}));return {bottom:r.bottom,panelBottom:p.bottom}})});
      await check('cart and payment modal',async()=>{await page.locator('.pp-product').first().click();await expect(page.locator('.pp-cart-line')).toHaveCount(1);await page.locator('.pp-checkout').click();await expect(page.getByRole('dialog')).toBeVisible();const evidence=await bounds();if(evidence.some(r=>r.x<0||r.right>width+1))throw Error(JSON.stringify(evidence));if(!process.env.VISUAL_GEOMETRY_ONLY)await page.screenshot({path:`${out}/${width}-pos-payment.png`,fullPage:true});await page.keyboard.press('Escape');return evidence});
     }
     if(route==='/inventory')await check('quick receive selectors and modal',async()=>{await page.getByRole('button',{name:'Tezkor kirim',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();const evidence=await bounds();if(!process.env.VISUAL_GEOMETRY_ONLY)await page.screenshot({path:`${out}/${width}-quick-receive.png`,fullPage:true});if(evidence.some(r=>r.x<0||r.right>width+1))throw Error(JSON.stringify(evidence));await page.keyboard.press('Escape');return evidence});
     if(route==='/sales')await check('customer dropdown attached and reachable',async()=>{const tab=page.getByRole('tab',{name:/Savat/});if(await tab.isVisible())await tab.click();const input=page.getByPlaceholder('Mijoz (ixtiyoriy)');await input.fill('Juda');await expect(page.locator('.pos-customer-results')).toBeVisible();const evidence=await page.evaluate(()=>{const i=document.querySelector('.pos-customer-selector input').getBoundingClientRect(),r=document.querySelector('.pos-customer-results').getBoundingClientRect();return {inputBottom:i.bottom,dropdownTop:r.top,gap:r.top-i.bottom,dropdownBottom:r.bottom,height:innerHeight}});if(!process.env.VISUAL_GEOMETRY_ONLY)await page.screenshot({path:`${out}/${width}-customer-dropdown.png`,fullPage:true});if(Math.abs(evidence.gap)>20)throw Error(JSON.stringify(evidence));const option=page.locator('.pos-customer-results button').filter({hasText:'Juda uzun ism va familiyali sintetik mijoz'});await expect(option).toBeVisible();await option.click();await expect(input).toHaveValue('Juda uzun ism va familiyali sintetik mijoz');return evidence});
     if(['/login','/register','/reset-password'].includes(route))await check('auth focused input in reduced viewport',async()=>{await page.locator('input:not([type="hidden"])').first().focus();await page.setViewportSize({width,height:Math.max(350,height-300)});await page.locator('input:focus').scrollIntoViewIfNeeded();const e=await page.locator('input:focus').boundingBox();if(e.y<0||e.y+e.height>Math.max(350,height-300))throw Error('focused input outside resized viewport');if(!process.env.VISUAL_GEOMETRY_ONLY)await page.screenshot({path:`${out}/${width}-${route.slice(1)}-resized.png`,fullPage:true});await page.setViewportSize({width,height});return e});
     if(route==='/?ai=open')await check('AI composer reduced viewport and orientation',async()=>{const input=page.locator('.zenix-ai-compose textarea');await expect(input).toBeVisible();await input.focus();await page.setViewportSize({width,height:Math.max(350,height-300)});await page.waitForTimeout(100);const rect=await input.boundingBox();if(rect.y<0||rect.y+rect.height>Math.max(350,height-300))throw Error(JSON.stringify(rect));if(!process.env.VISUAL_GEOMETRY_ONLY)await page.screenshot({path:`${out}/${width}-ai-resized.png`,fullPage:true});await page.setViewportSize({width:height,height:width});await expect(input).toBeVisible();await page.setViewportSize({width,height});return rect});
    }
   }catch(e){results.push({width,height,route,error:e.message});}
  }
  await writeFile(`${out}/measurements.json`,JSON.stringify({results,errors,interactions},null,2));
  console.log(`Completed ${width}: ${results.length} cases`);
  await context.close();
 }
}finally{await writeFile(`${out}/measurements.json`,JSON.stringify({results,errors,interactions},null,2));await browser.close();await new Promise(r=>server.httpServer.close(r));}
console.log(JSON.stringify({cases:results.length,errors,failedRoutes:results.filter(r=>r.error),overflowCases:results.filter(r=>r.outside?.length).length},null,2));
if(process.env.VISUAL_STRICT){
 assert.deepEqual(errors,[],'runtime errors');
 assert.deepEqual(results.filter(r=>r.error),[],'route render failures');
 assert.deepEqual(interactions.filter(r=>r.status==='FAIL'),[],'interaction regressions');
 for(const r of results){
  assert.equal(r.url,new URL(r.route,base).pathname,'requested route coverage');
  assert.deepEqual(r.headerOverflow,[],`${r.width}: header controls must fit`);
  assert.notEqual(r.launcherHit,false,`${r.width} ${r.route}: launcher center must be clickable`);
  assert.equal(r.collisions.length,0,`${r.width} ${r.route}: launcher collision`);
  assert.deepEqual(r.outside.filter(e=>!e.scrollContainer),[],`${r.width} ${r.route}: uncontained child overflow`);
  if(r.route==='/')assert.equal(r.zeroTicks,0,'repeated 0k labels');
  if(r.width>=1366&&!process.env.VISUAL_STRESS)assert.ok(r.headerText.every(t=>t.scrollWidth<=t.width+1),'short topbar names should fit');
  if(r.route==='/pos-pro'&&r.width<=900){assert.ok(r.cart.height<=421,'bounded mobile cart');assert.ok(r.header.height<190,'compact mobile header')}
  if(['/products','/pos-pro','/login','/register','/reset-password'].includes(r.route))assert.deepEqual(r.outside,[],`${r.width} ${r.route}: child overflow`);
 }
}
