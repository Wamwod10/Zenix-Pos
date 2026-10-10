import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {randomUUID,randomInt} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
// No provider mocks: verifies fail-closed dashboard against real Express + local PG.
delete process.env.BACKUP_PROVIDER;
assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL,{nodeEnv:process.env.NODE_ENV});
assert.equal(process.env.DATABASE_URL,process.env.TEST_DATABASE_URL);
process.env.FRONTEND_ORIGIN='http://localhost:5186';process.env.VITE_API_URL='http://localhost:5192';
const [{app},{pool},{default:bcrypt}]=await Promise.all([import('../../backend/src/app.js'),import('../../backend/src/db/pool.js'),import('../../backend/node_modules/bcryptjs/index.js')]);
const out=path.resolve('../artifacts/final-two/recovery');await fs.mkdir(out,{recursive:true});
let browser,vite,server;const evidence=[],errors=[];
evidence.push=(...items)=>{console.log('SaaS: '+items.join('; '));return Array.prototype.push.apply(evidence,items)};
const base='http://localhost:5186';
async function request(page,url,body,expected=200){
 const result=await page.evaluate(async({url,body})=>{const r=await fetch('http://localhost:5192'+url,{credentials:'include',method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-Zenix-Client':'web'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()}},{url,body});
 assert.equal(result.status,expected,`${url}: ${JSON.stringify(result.data)}`);return result.data.data??result.data;
}
async function login(page,username,password){
 await page.goto(base+'/login');await page.locator('input[autocomplete="username"]').fill(username);await page.locator('input[type="password"]').fill(password);await page.locator('button[type="submit"]').click();await page.waitForURL(url=>!url.pathname.includes('login'));return page;
}
async function logout(page){
 await page.getByRole('button',{name:'Foydalanuvchi menyusi'}).click();await page.getByRole('button',{name:'Chiqish',exact:true}).click();
 const confirmLogout=page.getByRole('dialog');if(await confirmLogout.count())await confirmLogout.getByRole('button',{name:'Chiqish',exact:true}).click();
 await page.waitForURL(base+'/login');
}
async function makeTenant(role='OWNER'){
 const org=(await pool.query("INSERT INTO organizations(name,license_status,expiry_date,store_limit,plan) VALUES($1,'ACTIVE',CURRENT_DATE+45,2,'MONTHLY') RETURNING id",['Final SaaS '+randomUUID()])).rows[0].id;
 const store=(await pool.query("INSERT INTO stores(organization_id,name) VALUES($1,'SaaS test branch') RETURNING id",[org])).rows[0].id;
 const username='saas-'+randomUUID(),password=randomUUID()+'Aa1!';
 const user=(await pool.query("INSERT INTO users(organization_id,store_id,name,username,password_hash,app_role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[org,store,'SaaS '+role,username,await bcrypt.hash(password,10),role])).rows[0].id;
 return {org,store,user,username,password};
}
try{
 const tenant=await makeTenant(),admin={username:'recovery-admin-'+randomUUID(),password:randomUUID()+'Aa1!'};
 const adminId=(await pool.query("INSERT INTO users(name,username,password_hash,app_role) VALUES('Recovery operator',$1,$2,'PLATFORM_ADMIN') RETURNING id",[admin.username,await bcrypt.hash(admin.password,10)])).rows[0].id;
 server=app.listen(5192,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 vite=await createServer({server:{host:'127.0.0.1',port:5186,strictPort:true,hmr:false,watch:null}});await vite.listen();
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await login(page,tenant.username,tenant.password);
 await request(page,`/api/platform/organizations/${tenant.org}/backups`,undefined,403);
 await request(page,`/api/platform/organizations/${tenant.org}/recovery-preview`,undefined,403);
 await logout(page);await login(page,admin.username,admin.password);
 const backups=await request(page,`/api/platform/organizations/${tenant.org}/backups`);assert.equal(backups.backups.available,false);assert.equal(backups.backups.restoreAvailable,false);
 await request(page,`/api/platform/organizations/${tenant.org}/backups?limit=0`,undefined,400);
 await request(page,`/api/platform/organizations/${tenant.org}/recovery-preview?snapshotId=not-a-real-snapshot`,undefined,409);
 await page.getByRole('button',{name:'Recovery',exact:true}).click();await page.locator('.pro-search input').fill('Final SaaS');
 // Search by unique organization name rather than rely on unrelated test fixtures.
 const orgName=(await pool.query('SELECT name FROM organizations WHERE id=$1',[tenant.org])).rows[0].name;
 await page.locator('.pro-search input').fill(orgName);await page.locator('tr').filter({hasText:orgName}).getByRole('button',{name:'Tashkilotni ko‘rish'}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Tekshirish',exact:true}).click();
 const panel=dialog.getByRole('region',{name:'Backup va recovery'});await panel.waitFor();
 await panel.getByText('Backup mavjud emas yoki tekshirilmagan',{exact:true}).waitFor();
 assert.equal(await panel.getByRole('button',{name:'Tiklash hozir mavjud emas'}).isDisabled(),true);
 await panel.getByRole('button',{name:'Provider holatini yangilash'}).click();await panel.getByRole('button',{name:'Provider holatini yangilash'}).waitFor();
 await panel.screenshot({path:path.join(out,'recovery-desktop.png')});
 await page.setViewportSize({width:375,height:850});await panel.scrollIntoViewIfNeeded();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await panel.screenshot({path:path.join(out,'recovery-mobile.png')});
 const audit=(await pool.query("SELECT action FROM audit_logs WHERE organization_id=$1 AND user_id=$2 AND action IN ('backup_history','recovery_preview')",[tenant.org,adminId])).rows;
 assert.ok(audit.some(row=>row.action==='backup_history'));assert.ok(audit.some(row=>row.action==='recovery_preview'));assert.equal(errors.length,0);
 evidence.push('Real owner permission denial; admin read-only API; invalid pagination/snapshot denied; server audit present','Desktop/mobile recovery unavailable state and disabled restore verified; no provider mocked');
 await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify({status:'PASS',providerConnection:'BLOCKED',restoreDrill:'BLOCKED',evidence,errors},null,2));
}catch(error){console.error(error.message);await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify({status:'FAIL',error:error.message,evidence,errors},null,2));process.exitCode=1}
finally{await browser?.close();await vite?.close();if(server)await new Promise(resolve=>server.close(resolve));await pool.end()}
