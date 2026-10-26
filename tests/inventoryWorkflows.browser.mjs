// Stateful synthetic API browser checks. These do not prove database effects.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const output=path.resolve('../artifacts/frontend-master-20261026/inventory-workflows');
await mkdir(output,{recursive:true});
const storeA='11111111-1111-4111-8111-111111111111',storeB='22222222-2222-4222-8222-222222222222';
const productId='33333333-3333-4333-8333-333333333333',transferId='44444444-4444-4444-8444-444444444444';
const requests=[],results=[],errors=[];
let quantity=10,transfers=[],countAttempts=0,transferAttempts=0,cancelAttempts=0;
const product=()=>({id:productId,name:'Workflow Product',sku:'WF-1',unit:'dona',costPrice:1000,sellPrice:1500,stockByStore:{[storeA]:quantity,[storeB]:0},costByStore:{[storeA]:1000,[storeB]:1000}});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const page=await browser.newPage({viewport:{width:1366,height:900},serviceWorkers:'block'});page.setDefaultTimeout(7000);
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const body=request.method()==='GET'?null:request.postDataJSON();
  requests.push({method:request.method(),path:url.pathname,body});
  const reject=()=>route.fulfill({status:503,json:{ok:false,error:{code:'SYNTHETIC_FAILURE',message:'Synthetic retry required'}}});
  let data={users:[],sessions:[],revision:'1',holds:[]};
  if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'synthetic-org',appRole:'OWNER',name:'Synthetic Owner'}};
  if(url.pathname==='/api/bootstrap')data={stores:[{id:storeA,name:'Source',active:true},{id:storeB,name:'Destination',active:true}],inventory:[product()],inventoryTransfers:transfers,inventoryCounts:[],employees:[],suppliers:[],activeShifts:{},organization:{id:'synthetic-org',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:3}};
  if(url.pathname==='/api/settings')data={selectedStoreId:storeA,businessFeatures:{stockTransfers:true}};
  if(url.pathname==='/api/warehouses')data={warehouses:[{id:'warehouse-a',name:'Main',store_id:storeA,is_default:true}],balances:[{warehouse_id:'warehouse-a',product_id:productId,quantity}]};
  if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500},aggregate:{}};
  if(url.pathname==='/api/ai/status')data={enabled:false};
  if(url.pathname==='/api/inventory/counts'&&body){
    assert.deepEqual(body,{storeId:storeA,requireApproval:false,changes:[{productId,before:10,after:13}]});
    if(++countAttempts===1)return reject();
    quantity=13;data={count:{id:'count-1',status:'approved',changes:body.changes}};
  }
  if(url.pathname==='/api/inventory/transfers'&&body){
    assert.deepEqual(body,{fromStoreId:storeA,toStoreId:storeB,needsApproval:false,items:[{productId,quantity:3}]});
    if(++transferAttempts===1)return reject();
    quantity-=3;const transfer={id:transferId,fromStoreId:storeA,toStoreId:storeB,from:'Source',to:'Destination',status:'IN_TRANSIT',itemCount:1,createdAt:new Date().toISOString(),createdBy:'Synthetic Owner',items:[{productId,product:'Workflow Product',qty:3,unit:'dona'}]};
    transfers=[transfer];data={transfer};
  }
  if(url.pathname===`/api/inventory/transfers/${transferId}/cancel`){
    assert.deepEqual(body,{});cancelAttempts++;quantity+=3;transfers=transfers.map(row=>({...row,status:'REJECTED'}));data={transfer:transfers[0]};
  }
  return route.fulfill({json:{ok:true,data}});
});

try{
  await page.goto(base+'/inventory');await page.locator('.inventory-tabs').waitFor();
  await page.locator('.inventory-tabs').getByRole('button',{name:'Inventarizatsiya',exact:true}).click();
  await page.locator('.revision-input').fill('13');
  const approve=page.locator('section.pro-card .pro-card-head').getByRole('button',{name:'Tasdiqlash',exact:true});
  await approve.click();await page.locator('.inventory-pro .pro-alert.danger').waitFor();
  assert.equal(await page.locator('.revision-input').inputValue(),'13','failed count must preserve draft');
  await approve.click();await page.waitForFunction(()=>document.querySelector('.revision-input')?.value==='');
  await page.locator('td[data-label="Tizimda"]').filter({hasText:'13 dona'}).waitFor();
  assert.equal(countAttempts,2);results.push({flow:'Inventory count',checks:['10→13 request contract','503 error visible','draft retained','retry succeeds','bootstrap refresh renders 13'],status:'passed'});
  await page.screenshot({path:path.join(output,'count-after-retry.png')});

  await page.locator('.inventory-tabs').getByRole('button',{name:'Transferlar',exact:true}).click();
  const selects=page.locator('.transfer-builder [role="combobox"]');
  await selects.nth(0).click();await page.getByRole('option',{name:'Destination',exact:true}).click();
  await selects.nth(1).click();await page.getByRole('option',{name:'Workflow Product · 13 dona',exact:true}).click();
  await page.locator('.transfer-qty-action input').fill('3');
  await page.locator('.transfer-qty-action').getByRole('button',{name:'Qo‘shish',exact:true}).click();
  const create=page.getByRole('button',{name:'Transfer yaratish',exact:true});
  await create.click();await page.locator('.inventory-pro .pro-alert.danger').waitFor();
  assert.match(await page.locator('.transfer-draft-items').innerText(),/3 dona/,'failed transfer must retain draft');
  await create.click();await page.locator('.transfer-row').filter({hasText:'Yo‘lda'}).waitFor();
  assert.equal(transferAttempts,2);assert.equal(quantity,10);
  results.push({flow:'Branch transfer create',checks:['destination/product/quantity UI','503 error visible','draft retained','retry same contract','bootstrap refresh renders IN_TRANSIT'],status:'passed'});
  await page.screenshot({path:path.join(output,'transfer-after-retry.png')});

  await page.locator('.transfer-row-actions').getByRole('button',{name:'Bekor qilish',exact:true}).click();
  await page.getByRole('dialog').waitFor();assert.equal(cancelAttempts,0,'opening confirmation must not send cancellation');
  await page.getByRole('dialog').getByRole('button',{name:'Ortga',exact:true}).click();assert.equal(cancelAttempts,0);
  await page.locator('.transfer-row-actions').getByRole('button',{name:'Bekor qilish',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Bekor qilish',exact:true}).click();
  await page.locator('.transfer-row').filter({hasText:'Rad etildi'}).waitFor();
  assert.equal(cancelAttempts,1);assert.equal(quantity,13);
  results.push({flow:'Branch transfer cancellation',checks:['confirmation opens without write','decline sends no request','confirm posts empty cancellation body','bootstrap refresh renders rejected'],status:'passed'});
  assert.deepEqual(errors,[]);
}catch(error){results.push({status:'failed',message:error.message});await page.screenshot({path:path.join(output,'failure.png')});throw error;}
finally{
  await writeFile(path.join(output,'results.json'),JSON.stringify({scope:'Real React components with stateful synthetic API mocks; not database proof',results,requests,errors,gaps:['No live database or concurrent stock mutation','No transfer receiving, tracked batches/serials or count approval role flow','No supplier or expense workflow in this script']},null,2));
  await browser.close();await server.close();
  console.log(JSON.stringify(results));
}
