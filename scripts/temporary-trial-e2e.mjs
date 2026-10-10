import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {randomUUID,randomInt} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL,{nodeEnv:process.env.NODE_ENV});
assert.equal(process.env.DATABASE_URL,process.env.TEST_DATABASE_URL);
process.env.TRIAL_PHONE_VERIFICATION_MODE='temporary_disabled';process.env.TRIAL_PHONE_VERIFICATION_DISABLED_UNTIL=new Date(Date.now()+3600000).toISOString();
delete process.env.SMS_PROVIDER;delete process.env.OTP_HMAC_SECRET;
process.env.FRONTEND_ORIGIN='http://localhost:5186';process.env.VITE_API_URL='http://localhost:5192';
const [{app},{pool},{default:bcrypt}]=await Promise.all([import('../../backend/src/app.js'),import('../../backend/src/db/pool.js'),import('../../backend/node_modules/bcryptjs/index.js')]);
const out=path.resolve('../artifacts/no-sms');await fs.mkdir(out,{recursive:true});let server,vite,browser;const errors=[];
try{
 server=app.listen(5192,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 vite=await createServer({server:{host:'127.0.0.1',port:5186,strictPort:true,hmr:false,watch:null}});await vite.listen();
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({extraHTTPHeaders:{'X-Forwarded-For':`198.19.${randomInt(1,254)}.${randomInt(1,254)}`}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5186/register');await page.getByRole('button',{name:'Davom etish',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);
 assert.equal(await page.locator('.registration-otp').count(),0);assert.equal(await page.locator('input[autocomplete="one-time-code"]').count(),0);
 const phone='+99890'+randomInt(1000000,9999999);
 await page.getByPlaceholder('Masalan: Baraka Market').fill('No SMS disposable trial');await page.getByPlaceholder('Ism familiya').fill('Fixture owner');await page.locator('input[type="tel"]').fill(phone);await page.locator('input[autocomplete="username"]').fill('no-sms-'+randomUUID());await page.locator('input[autocomplete="new-password"]').fill(randomUUID()+'Aa1!');
 for(const width of [320,375,430,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,`registration-${width}.png`),fullPage:true})}
 const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/register'));await page.getByRole('button',{name:'Davom etish',exact:true}).click();const registered=await response;assert.equal(registered.status(),201);const result=(await registered.json()).data;
 const org=(await pool.query('SELECT settings FROM organizations WHERE id=$1',[result.user.organizationId])).rows[0];assert.equal(org.settings.phoneVerifiedAt,undefined);assert.equal(org.settings.trialPhoneVerification,'TEMPORARILY_UNVERIFIED');assert.equal(Date.parse(org.settings.trialEndsAt)-Date.parse(org.settings.trialStartedAt),14*86400000);
 await page.waitForURL('http://localhost:5186/');
 // Use an authenticated API call in browser to verify ordinary owner denial.
 assert.equal(await page.evaluate(async()=> (await fetch('http://localhost:5192/api/platform/overview',{credentials:'include'})).status),403);
 const admin={username:'temporary-admin-'+randomUUID(),password:randomUUID()+'Aa1!'};
 await pool.query("INSERT INTO users(name,username,password_hash,app_role) VALUES('Temporary test admin',$1,$2,'PLATFORM_ADMIN')",[admin.username,await bcrypt.hash(admin.password,10)]);
 const adminPage=await(await browser.newContext()).newPage();await adminPage.goto('http://localhost:5186/login');await adminPage.locator('input[autocomplete="username"]').fill(admin.username);await adminPage.locator('input[type="password"]').fill(admin.password);await adminPage.locator('button[type="submit"]').click();await adminPage.getByRole('alert').filter({hasText:'SMSsiz trial rejimi'}).waitFor();await adminPage.screenshot({path:path.join(out,'admin-warning.png'),fullPage:true});
 process.env.TRIAL_PHONE_VERIFICATION_MODE='required';await page.goto('http://localhost:5186/register');await page.getByRole('button',{name:'SMS kod yuborish',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Davom etish',exact:true}).isDisabled(),true);
 process.env.TRIAL_PHONE_VERIFICATION_MODE='temporary_disabled';process.env.TRIAL_PHONE_VERIFICATION_DISABLED_UNTIL=new Date(Date.now()-1000).toISOString();await page.reload();await page.getByRole('button',{name:'SMS kod yuborish',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Davom etish',exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify({passed:true,realSMSUsed:false,productionTouched:false,flow:['No OTP UI, real browser/API/PG 14-day unverified trial','320/375/430/1440 screenshots','Owner denied platform overview; authenticated admin sees cutoff warning','Required mode and expired temporary mode require OTP'],pageErrors:errors},null,2));console.log('Temporary no-SMS browser PASS');
}finally{await browser?.close();await vite?.close();await new Promise(r=>server?server.close(r):r());await pool.end()}
