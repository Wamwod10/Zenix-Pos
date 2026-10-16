// Local-only synthetic UI benchmark. All API traffic is intercepted.
import {chromium} from 'playwright-core';
import {createServer,build,preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const baseline=process.argv.includes('--baseline');
const output=path.resolve('.cache/performance');
await mkdir(output,{recursive:true});
const legacyPlugin={name:'benchmark-legacy-search',enforce:'pre',transform(code,id){
 if(!baseline)return;
 const file=id.replaceAll('\\','/');
 for(const relative of ['src/pages/sales/Sales.jsx','src/utils/posCartReconciliation.js']){
  if(file.endsWith('/'+relative))return execFileSync(process.env.GIT_EXECUTABLE||'git',['-c',`safe.directory=${process.cwd()}`,'show',`6b69a9f03bfecabb02a02c586a5d45fe5494c0a2:${relative}`],{encoding:'utf8'});
 }
}};
const production=process.argv.includes('--production');
let vite;
if(production){
 const outDir=path.join(output,baseline?'build-before':'build-after');
 await build({plugins:[legacyPlugin],build:{outDir,emptyOutDir:true},logLevel:'error'});
 vite=await preview({build:{outDir},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
}else{
 vite=await createServer({plugins:[legacyPlugin],cacheDir:path.join(output,baseline?'vite-before':'vite-after'),server:{host:'127.0.0.1',port:0},logLevel:'error'});
 await vite.listen();
}
let browser;
const results=[],errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const store='11111111-1111-4111-8111-111111111111';
 const inventory=Array.from({length:50000},(_,i)=>({id:`product-${i}`,name:`Guruch ${i} qadoq`,sku:`SKU-${i}`,barcode:`998${String(i).padStart(10,'0')}`,category:'Food',unit:'dona',sellPrice:12500,costPrice:10000,stockByStore:{[store]:100}}));
 const widths=process.env.ZENIX_PERF_WIDTHS?process.env.ZENIX_PERF_WIDTHS.split(',').map(Number):[390,768,1366,1920];
 for(const width of process.argv.includes('--profile')?[390]:widths){
  console.log(`Benchmark ${baseline?'before':'after'}: ${width}px`);
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname;
   let data={users:[],sessions:[],revision:'1',holds:[]};
   if(p==='/api/auth/me')data={user:{id:'owner',organizationId:'synthetic-org',appRole:'OWNER',name:'Test'}};
   if(p==='/api/bootstrap')data={stores:[{id:store,name:'Test'}],inventory,activeShifts:{[store]:{id:'shift',storeId:store,status:'open',openedAtISO:new Date().toISOString()}},organization:{id:'synthetic-org',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:1}};
   if(p==='/api/settings')data={selectedStoreId:store};
   if(p==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
   if(p==='/api/ai/status')data={enabled:true,writable:true,writesEnabled:false,limit:100,remaining:100,suggestions:[]};
   await route.fulfill({json:{ok:true,data}});
  });
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:width<768?4:1});
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/sales`);
  console.log('Page loaded');
  await page.getByRole('textbox',{name:'Mahsulot qidirish',exact:true}).waitFor();
  await page.locator('.pos-product').first().waitFor();
  console.log('Catalog ready');
  await page.bringToFront();
  if(process.argv.includes('--profile')){await cdp.send('Profiler.enable');await cdp.send('Profiler.start')}
  // Native input event -> React result DOM commit (does not claim physical paint).
  const samples=await page.evaluate(async()=>{
   const input=document.querySelector('.pos-search input');
   const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
   const samples=[];
   for(let i=0;i<35;i++){
    const query=`Guruch ${49900+i} qadoq`;
    const start=performance.now();set.call(input,query);input.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise((resolve,reject)=>{
     const deadline=performance.now()+10000;
     const check=()=>{
      if(document.querySelector('.pos-product strong')?.textContent===query)return resolve();
      if(performance.now()>deadline)return reject(new Error('search result did not commit'));
      setTimeout(check,0);
     };setTimeout(check,0);
    });
    if(i>=5)samples.push(performance.now()-start);
   }
   return samples.sort((a,b)=>a-b);
  });
  assert.equal(await page.locator('.pos-product').count(),1);
  if(process.argv.includes('--profile')){
   const {profile}=await cdp.send('Profiler.stop');
   await writeFile(path.join(output,'search.cpuprofile'),JSON.stringify(profile));
   console.log(JSON.stringify(profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,12).map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,hits:n.hitCount}))));
  }
  console.log('Search samples complete');
  if(!baseline){await page.evaluate(()=>{
   document.activeElement?.blur();
   for(let i=0;i<20;i++){
    const code='998'+String(49995+i%5).padStart(10,'0');
    for(const key of [...code,'Enter'])document.body.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
   }
  });
  await page.waitForFunction(()=>document.querySelectorAll('.cart-item').length===5);
  const quantities=await page.locator('.cart-item .qty-value').allTextContents();
  assert.deepEqual(quantities,['4','4','4','4','4'],'all 20 consecutive scans reach the cart');}
  await page.evaluate(()=>document.querySelector('.pos-camera-scan').click());
  await page.waitForSelector('[role="dialog"]',{state:'attached',timeout:10000});
  results.push({width,products:inventory.length,cpuThrottle:width<768?4:1,samples:samples.length,p50:samples[14],p95:samples[28],p99:samples[29],barcodeScans:baseline?null:20,cartLines:baseline?null:5,quantityPerLine:baseline?null:4});
  await page.screenshot({path:path.join(output,`${baseline?'before':'after'}-${width}.png`)});
  await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(path.join(output,process.argv.includes('--profile')?'browser-profile.json':`${production?'production-':''}browser-${baseline?'before':'after'}.json`),JSON.stringify({mode:baseline?'legacy':'indexed',production,results,errors},null,2));
 console.log(JSON.stringify({mode:baseline?'legacy':'indexed',results,errors}));
}catch(error){console.error(error);throw error}finally{await browser?.close();if(production)await new Promise(resolve=>vite.httpServer.close(resolve));else await vite.close()}
