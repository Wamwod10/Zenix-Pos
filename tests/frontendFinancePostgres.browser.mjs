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
const evidence={scope:'Actual source React Chromium -> local Express -> disposable local PostgreSQL. Test tenant only.',checks:[]};
try{
 const suffix=randomUUID(),org=(await pool.query("INSERT INTO organizations(name,license_status,expiry_date) VALUES($1,'ACTIVE','2099-01-01') RETURNING id",['Finance browser '+suffix])).rows[0].id;
 const store=(await pool.query("INSERT INTO stores(organization_id,name) VALUES($1,'Finance test branch') RETURNING id",[org])).rows[0].id;
 const user=(await pool.query("INSERT INTO users(organization_id,store_id,name,username,password_hash,app_role) VALUES($1,$2,'Finance Owner',$3,'test-only','OWNER') RETURNING id",[org,store,suffix])).rows[0].id;
 const token=randomUUID();await pool.query("INSERT INTO auth_sessions(user_id,token_hash,expires_at,last_seen_at) VALUES($1,$2,now()+interval '1 day',now())",[user,sha256(token)]);
 const shift=(await pool.query("INSERT INTO shifts(organization_id,store_id,cashier_id,opening_cash,register_key) VALUES($1,$2,$3,100000,$4) RETURNING id",[org,store,user,`store:${store}`])).rows[0].id;
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});await context.addCookies([{name:'zenix_session',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let dropPayment=true;const paymentRequests=[];const summaries=[];
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
  const response=await route.fetch({url:backend+url.pathname+url.search,headers:{...req.headers(),origin:'http://localhost:5173',cookie:`zenix_session=${token}`}});
  if(url.pathname.endsWith('/payments')&&req.method()==='POST'){paymentRequests.push({body:req.postDataJSON(),status:response.status()});if(dropPayment){dropPayment=false;return route.abort()}}
  if(url.pathname===`/api/shifts/${shift}/summary`)summaries.push(await response.json());await route.fulfill({response});
 });
 await page.goto(base+'/customers');await page.getByRole('button',{name:'Mijoz qo‘shish',exact:true}).click();const create=page.getByRole('dialog',{name:'Yangi mijoz'});
 await create.getByLabel('Ism *',{exact:true}).fill('Finance borrower');await create.getByRole('button',{name:'Saqlash',exact:true}).click();await expect(create).toHaveCount(0);
 const customer=(await pool.query('SELECT id,name FROM customers WHERE organization_id=$1',[org])).rows;assert.equal(customer.length,1);assert.equal(customer[0].name,'Finance borrower');
 evidence.checks.push('Customer created through UI and verified in PostgreSQL');
 await pool.query("INSERT INTO customer_ledger(organization_id,customer_id,store_id,entry_type,amount) VALUES($1,$2,$3,'CREDIT_SALE',60000)",[org,customer[0].id,store]);
 await page.reload();await page.locator('.customer-card').filter({hasText:'Finance borrower'}).click();const detail=page.getByRole('dialog',{name:'Finance borrower'});
 await detail.getByLabel('Nasiya tolov summasi',{exact:true}).fill('25000');await detail.getByRole('button',{name:'To‘lov qabul qilish',exact:true}).click();
 await expect(detail.getByLabel('Nasiya tolov summasi',{exact:true})).toBeDisabled();await expect.poll(()=>paymentRequests.length).toBe(1);assert.equal(paymentRequests.length,1);assert.equal(paymentRequests[0].status,200);
 const pendingKey=`zenix:customer-payment:v1:${org}:${user}:${store}:${customer[0].id}`;
 const pending=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),pendingKey);assert.ok(pending?.reference);
 await page.screenshot({path:out+'/customer-payment-lost-response.png',fullPage:true});
 await page.reload();await page.locator('.customer-card').filter({hasText:'Finance borrower'}).click();await expect(detail.getByLabel('Nasiya tolov summasi',{exact:true})).toHaveValue('25000');await expect(detail.getByLabel('Nasiya tolov summasi',{exact:true})).toBeDisabled();
 await detail.getByRole('button',{name:'To‘lov qabul qilish',exact:true}).click();await expect(detail.getByLabel('Nasiya tolov summasi',{exact:true})).toHaveValue('');
 assert.equal(paymentRequests.length,2);assert.deepEqual(paymentRequests[0].body,paymentRequests[1].body);assert.equal(paymentRequests[0].body.shiftId,shift);assert.equal(paymentRequests[0].body.storeId,store);assert.equal(paymentRequests[0].body.amount,25000);
 const payments=(await pool.query("SELECT id,amount,shift_id,repayment_client_reference FROM customer_ledger WHERE customer_id=$1 AND entry_type='PAYMENT'",[customer[0].id])).rows;assert.equal(payments.length,1);assert.equal(Number(payments[0].amount),-25000);assert.equal(payments[0].shift_id,shift);
 const movement=(await pool.query('SELECT amount,type,shift_id FROM shift_movements WHERE customer_payment_ledger_id=$1',[payments[0].id])).rows;assert.equal(movement.length,1);assert.equal(Number(movement[0].amount),25000);assert.equal(movement[0].type,'in');assert.equal(movement[0].shift_id,shift);
 const balance=Number((await pool.query('SELECT sum(amount) balance FROM customer_ledger WHERE customer_id=$1',[customer[0].id])).rows[0].balance);assert.equal(balance,35000);assert.equal(await page.evaluate(key=>localStorage.getItem(key),pendingKey),null);
 await expect(detail.locator('.customer-detail-kpis')).toContainText(/35[ ,]000/);await page.screenshot({path:out+'/customer-payment-confirmed.png',fullPage:true});evidence.checks.push('Lost committed cash-payment response recovered after browser reload with exact same payload/reference; one PAYMENT -25000 and one drawer in 25000; remaining debt35000');
 await page.goto(base+'/shifts');await expect(page.locator('.shift-metrics .expected')).toContainText(/125[ ,]000/);assert.ok(summaries.some(r=>r.data?.summary?.expectedCash===125000));
 await page.getByRole('button',{name:'Smenani yopish',exact:true}).click();const close=page.getByRole('dialog',{name:'Smenani yopish',exact:true});await close.getByLabel('Haqiqiy naqd',{exact:true}).fill('124000');await expect(close.getByRole('button',{name:'Smenani yopish',exact:true})).toBeDisabled();await close.getByLabel('Farq sababi *',{exact:true}).fill('Test counted shortage');await page.screenshot({path:out+'/shift-authoritative-close.png',fullPage:true});await close.getByRole('button',{name:'Smenani yopish',exact:true}).click();await page.getByRole('dialog',{name:'Smenani yopasizmi?',exact:true}).getByRole('button',{name:'Smenani yopish',exact:true}).click();await expect(page.locator('.shift-closed-card')).toBeVisible();
 const closed=(await pool.query('SELECT status,expected_cash,actual_cash,difference,metadata FROM shifts WHERE id=$1',[shift])).rows[0];assert.equal(closed.status,'closed');assert.equal(Number(closed.expected_cash),125000);assert.equal(Number(closed.actual_cash),124000);assert.equal(Number(closed.difference),-1000);assert.equal(closed.metadata.differenceReason,'Test counted shortage');await page.screenshot({path:out+'/shift-closed-history.png',fullPage:true});
 evidence.checks.push('Shifts UI authoritative API summary125000 includes customer cash repayment; discrepancy requires reason; confirmed UI close persisted expected125000 actual124000 difference-1000 and reason');
 evidence.paymentRequests=paymentRequests;evidence.closedShift=closed;evidence.errors=errors;assert.deepEqual(errors,[]);await writeFile(out+'/finance-browser-postgres.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));await context.close();
}finally{await browser.close();await web.close();await new Promise(r=>api.close(r));await pool.end()}
