// True browser -> local API -> disposable PostgreSQL acceptance. Never Neon.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
if(process.env.NODE_ENV!=='test'||process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL)throw Error('Local test database required');
const [{app},{pool},{sha256}]=await Promise.all([import('../../backend/src/app.js'),import('../../backend/src/db/pool.js'),import('../../backend/src/lib/crypto.js')]);
const api=app.listen(0,'127.0.0.1');await new Promise(r=>api.once('listening',r));
const backend=`http://127.0.0.1:${api.address().port}`,web=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'}),base=`http://127.0.0.1:${web.httpServer.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)}),errors=[];
try{
 const suffix=randomUUID(),org=(await pool.query("INSERT INTO organizations(name,license_status,expiry_date,settings) VALUES($1,'ACTIVE','2099-01-01',$2) RETURNING id",['Real browser test '+suffix,{workspaceSettings:{pos:{cashierDiscountAllowed:true,discountLimit:20}}}])).rows[0].id;
 const store=(await pool.query("INSERT INTO stores(organization_id,name) VALUES($1,'Real test branch') RETURNING id",[org])).rows[0].id;
 const user=(await pool.query("INSERT INTO users(organization_id,store_id,name,username,password_hash,app_role) VALUES($1,$2,'Browser kassir',$3,'test-only','OWNER') RETURNING id",[org,store,suffix])).rows[0].id;
 const token=randomUUID();await pool.query("INSERT INTO auth_sessions(user_id,token_hash,expires_at,last_seen_at) VALUES($1,$2,now()+interval '1 day',now())",[user,sha256(token)]);
 const shift=(await pool.query("INSERT INTO shifts(organization_id,store_id,cashier_id,opening_cash,register_key) VALUES($1,$2,$3,0,$4) RETURNING id",[org,store,user,`store:${store}`])).rows[0].id;
 const product=(await pool.query("INSERT INTO products(organization_id,name,unit,barcode,sell_price) VALUES($1,'Real olma','kg','12345678',12000) RETURNING id",[org])).rows[0].id;
 await pool.query('INSERT INTO inventory_balances(organization_id,store_id,product_id,quantity) VALUES($1,$2,$3,20)',[org,store,product]);
 const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});await context.addCookies([{name:'zenix_session',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();const response=await route.fetch({url:backend+url.pathname+url.search,headers:{...route.request().headers(),origin:'http://localhost:5173',cookie:`zenix_session=${token}`}});await route.fulfill({response})});
 await page.goto(base+'/pos-pro');await expect(page.locator('.pp-product').filter({hasText:'Real olma'})).toBeEnabled();
 await page.getByRole('heading',{name:'Joriy chek',exact:true}).click();for(let i=0;i<10;i++){await page.keyboard.type('12345678',{delay:6});await page.keyboard.press('Enter')}
 await expect(page.getByLabel('Real olma miqdori',{exact:true})).toHaveValue('10');
 await page.keyboard.press('F9');await expect(page.getByRole('dialog',{name:'To‘lov — Aralash'})).toBeVisible();await page.getByLabel('Karta summasi',{exact:true}).fill('50000');await page.getByLabel('Mijoz bergan naqd',{exact:true}).fill('100000');await page.getByText('Bank terminali / o‘tkazma muvaffaqiyatini tekshirdim.',{exact:false}).click();await page.getByText('Chek va to‘lov summasini tekshirdim.',{exact:false}).click();await page.getByRole('button',{name:'Tasdiqlab yakunlash',exact:true}).click();await expect(page.getByRole('dialog',{name:'Savdo tasdiqlandi'})).toBeVisible();
 const sale=(await pool.query('SELECT id,total FROM sales WHERE organization_id=$1',[org])).rows;assert.equal(sale.length,1);assert.equal(Number(sale[0].total),120000);
 assert.equal(Number((await pool.query('SELECT quantity FROM inventory_balances WHERE product_id=$1',[product])).rows[0].quantity),10);
 const payments=(await pool.query('SELECT method,amount FROM sale_payments WHERE sale_id=$1 ORDER BY method',[sale[0].id])).rows;assert.deepEqual(payments.map(p=>[p.method,Number(p.amount)]),[['card',50000],['cash',70000]]);
 assert.equal(Number((await pool.query("SELECT count(*) n FROM notification_outbox WHERE organization_id=$1 AND event_type='sale.completed'",[org])).rows[0].n),1);
 await page.getByRole('button',{name:'Yangi chek',exact:true}).click();await expect(page.locator('.pp-cart-line')).toHaveCount(0);
 await page.locator('.pp-live summary').click();await expect(page.locator('.pp-live')).toContainText('120');
 await page.goto(base+'/sales');await expect(page.locator('.pos-product').filter({hasText:'Real olma'})).toBeVisible();
 assert.deepEqual(errors,[]);await mkdir('../artifacts/phase2',{recursive:true});await writeFile('../artifacts/phase2/real-browser-postgres.json',JSON.stringify({passed:true,sales:1,total:120000,stockAfter:10,payments,errors,scope:'Actual React browser -> Express API -> isolated local PostgreSQL; HID simulated, bank manually confirmed; no hardware print'},null,2));console.log('PASS real browser -> Express -> PostgreSQL: 10 scans, split payment, stock, notification outbox, live summary, ordinary Sales regression');
}finally{await browser.close();await new Promise(r=>web.httpServer.close(r));await new Promise(r=>api.close(r));await pool.end()}
