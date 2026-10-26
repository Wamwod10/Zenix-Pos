// True browser -> local API -> disposable PostgreSQL acceptance. Never Neon.
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
if(process.env.NODE_ENV!=='test'||process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL)throw Error('Local test database required');
const backendDirectory=new URL(process.env.POS_PRO_BACKEND_DIRECTORY||'../../backend/',import.meta.url);
const [{app},{pool},{sha256}]=await Promise.all(['src/app.js','src/db/pool.js','src/lib/crypto.js'].map(path=>import(new URL(path,backendDirectory).href)));
const api=app.listen(0,'127.0.0.1');await new Promise(r=>api.once('listening',r));
const backend=`http://127.0.0.1:${api.address().port}`,web=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await web.listen();const base=`http://127.0.0.1:${web.httpServer.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)}),errors=[];

const out=process.env.FINAL_RELEASE_ARTIFACTS_DIR||'../artifacts/frontend-master-20261026/after';await mkdir(out,{recursive:true});
let closing=false;
const evidence={scope:'Actual source React Chromium -> local Express -> disposable local PostgreSQL. Test tenant only.',checks:[]};
try{
 const suffix=randomUUID(),org=(await pool.query("INSERT INTO organizations(name,license_status,expiry_date) VALUES($1,'ACTIVE','2099-01-01') RETURNING id",['Finance browser '+suffix])).rows[0].id;
 const store=(await pool.query("INSERT INTO stores(organization_id,name) VALUES($1,'Finance test branch') RETURNING id",[org])).rows[0].id;
 const user=(await pool.query("INSERT INTO users(organization_id,store_id,name,username,password_hash,app_role) VALUES($1,$2,'Finance Owner',$3,'test-only','OWNER') RETURNING id",[org,store,suffix])).rows[0].id;
 const token=randomUUID();await pool.query("INSERT INTO auth_sessions(user_id,token_hash,expires_at,last_seen_at) VALUES($1,$2,now()+interval '1 day',now())",[user,sha256(token)]);
 const shift=(await pool.query("INSERT INTO shifts(organization_id,store_id,cashier_id,opening_cash,register_key) VALUES($1,$2,$3,100000,$4) RETURNING id",[org,store,user,`store:${store}`])).rows[0].id;
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});await context.addCookies([{name:'zenix_session',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let dropPayment=false;const paymentRequests=[];const summaries=[];const bulkRequests=[];
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
  let response;try{response=await route.fetch({url:backend+url.pathname+url.search,headers:{...req.headers(),origin:'http://localhost:5173',cookie:`zenix_session=${token}`}})}catch(error){if(closing)return;throw new Error('Local backend proxy failed: '+req.method()+' '+url.pathname)};
  if(url.pathname==='/api/products/bulk'){bulkRequests.push({body:req.postDataJSON(),status:response.status()})}
  if(url.pathname.endsWith('/payments')&&req.method()==='POST'){paymentRequests.push({body:req.postDataJSON(),status:response.status()});if(dropPayment){dropPayment=false;return route.abort()}}
  if(url.pathname===`/api/shifts/${shift}/summary`)summaries.push(await response.json());await route.fulfill({response});
 });


 const ids=(await pool.query("INSERT INTO products(organization_id,name,sku,category,sell_price) VALUES($1,'Atomic A','ATOM-A','first',19),($1,'Atomic B','ATOM-B','second',29) RETURNING id",[org])).rows.map(row=>row.id);
 await page.goto(base+'/products');await expect(page.locator('.product-table tbody tr')).toHaveCount(2);
 await page.locator('.product-table thead .premium-check-box').click();await expect(page.getByRole('checkbox',{name:'Barcha mahsulotlarni tanlash',exact:true})).toBeChecked();
 await page.locator('.bulk-category-select').click();await page.getByRole('option',{name:'Kategoriyasiz',exact:true}).click();
 await expect(page.locator('.product-bulk-bar')).toHaveCount(0);await expect.poll(()=>bulkRequests.length).toBe(1);assert.equal(bulkRequests[0].status,200);
 assert.deepEqual((await pool.query('SELECT category FROM products WHERE organization_id=$1 ORDER BY sku',[org])).rows.map(r=>r.category),['','']);
 await page.locator('.zenix-toast-action').getByText('Bekor qilish',{exact:true}).click();await expect.poll(()=>bulkRequests.length).toBe(2);
 assert.equal(bulkRequests[1].status,200);assert.equal(bulkRequests[1].body.updates.length,2);
 await expect.poll(async()=>(await pool.query('SELECT category FROM products WHERE organization_id=$1 ORDER BY sku',[org])).rows.map(r=>r.category)).toEqual(['first','second']);
 await page.locator('.product-table thead .premium-check-box').click();await expect(page.getByRole('checkbox',{name:'Barcha mahsulotlarni tanlash',exact:true})).toBeChecked();
 await pool.query('INSERT INTO inventory_balances(organization_id,store_id,product_id,quantity,avg_cost) VALUES($1,$2,$3,1,2)',[org,store,ids[1]]);
 await page.locator('.product-bulk-bar').getByRole('button',{name:'Arxivlash',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Arxivlash',exact:true}).click();
 await expect.poll(()=>bulkRequests.length).toBe(3);assert.equal(bulkRequests[2].status,409);
 assert.equal((await pool.query('SELECT count(*)::int n FROM products WHERE organization_id=$1 AND archived=true',[org])).rows[0].n,0);
 await expect(page.locator('.product-table tbody tr')).toHaveCount(2);
 await page.screenshot({path:out+'/atomic-bulk-rejected.png',fullPage:true});
 evidence.checks=['UI sends one atomic common category update','Undo sends one atomic request preserving two different original categories','Concurrent stock change rejects archive; neither row archived, UI rows retained'];evidence.requests=bulkRequests;evidence.errors=errors;assert.deepEqual(errors,[]);
 await writeFile(out+'/atomic-bulk-browser-postgres.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));closing=true;await context.close();
}finally{closing=true;await browser.close();await web.close();await new Promise(r=>api.close(r));await pool.end()}
