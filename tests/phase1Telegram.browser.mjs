// Synthetic API only; no production, Telegram or paid provider requests.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const store='11111111-1111-4111-8111-111111111111';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
const errors=[],patches=[];let fail=false,release;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==base)return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    let data={users:[],sessions:[],revision:'1',holds:[]};
    if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'synthetic',appRole:'OWNER',name:'Test'}};
    if(url.pathname==='/api/bootstrap')data={stores:[{id:store,name:'Asosiy filial',active:true}],inventory:[],suppliers:[],telegramConnections:[{id:'connection',store_id:store,chat_id:'-1',chat_title:'Test group',settings:{sale:true}}],organization:{id:'synthetic',name:'Test',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:2}};
    if(url.pathname==='/api/settings')data={selectedStoreId:store,organization:{timezone:'Asia/Tashkent'}};
    if(url.pathname==='/api/finance')data={sales:[{id:'sale',storeId:store,businessDateISO:today,dateISO:today,total:15000,items:[{productId:'rice',name:'Guruch',quantity:1.5,unit:'kg',price:10000,costPrice:5000}]}],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
    if(url.pathname==='/api/ai/status')data={enabled:false};
    if(req.method()==='PATCH'&&url.pathname.includes('/telegram/')){
      patches.push(req.postDataJSON());await new Promise(resolve=>{release=resolve});
      if(fail)return route.fulfill({status:503,json:{ok:false,error:{message:'Test temporary failure'}}});
      data={connection:{settings:req.postDataJSON().settings}};
    }
    return route.fulfill({json:{ok:true,data}});
  });
  await page.goto(base+'/');
  await expect(page.locator('.top-product-list')).toContainText('1.5 kg');
  await page.goto(base+'/settings?tab=Telegram');
  const switches=page.locator('.settings-switch-group input[type=checkbox]');
  await expect(switches.first()).toBeEnabled();
  await switches.first().uncheck({force:true});
  await expect(switches.nth(1)).toBeDisabled();
  assert.deepEqual(patches,[{settings:{sale:false}}]);release();
  await expect(switches.first()).toBeEnabled();await expect(switches.first()).not.toBeChecked();
  fail=true;await switches.first().check({force:true});
  await expect(switches.first()).toBeDisabled();release();
  await expect(switches.first()).toBeEnabled();await expect(switches.first()).not.toBeChecked();
  await expect(page.getByText('Telegram sozlamasi saqlanmadi',{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('heading',{name:'Telegram bildirishnomalari'}).scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile horizontal overflow');
  await mkdir('../artifacts/phase1',{recursive:true});
  await page.screenshot({path:'../artifacts/phase1/telegram-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: actual units, serialized saves, rollback/error, mobile 390px; no browser errors');
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
