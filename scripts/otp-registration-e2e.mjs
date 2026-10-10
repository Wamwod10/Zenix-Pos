import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {randomUUID,randomInt,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL,{nodeEnv:process.env.NODE_ENV});
assert.equal(process.env.DATABASE_URL,process.env.TEST_DATABASE_URL);
process.env.SMS_PROVIDER='test';process.env.OTP_HMAC_SECRET=randomBytes(48).toString('hex');
process.env.FRONTEND_ORIGIN='http://localhost:5186';process.env.VITE_API_URL='http://localhost:5192';
const [{app},{pool},{takeTestSms}]=await Promise.all([import('../../backend/src/app.js'),import('../../backend/src/db/pool.js'),import('../../backend/src/services/smsProvider.js')]);
const out=path.resolve('../artifacts/final-18/otp');await fs.mkdir(out,{recursive:true});
let browser,vite,server;const evidence=[],errors=[];
try{
 server=app.listen(5192,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 vite=await createServer({server:{host:'127.0.0.1',port:5186,strictPort:true,hmr:false,watch:null}});await vite.listen();
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:375,height:900},extraHTTPHeaders:{'X-Forwarded-For':`198.18.${randomInt(0,255)}.${randomInt(1,255)}`}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5186/register');
 const phone='+99890'+String(randomInt(1000000,9999999));
 await page.getByPlaceholder('Masalan: Baraka Market').fill('OTP disposable business');await page.getByPlaceholder('Ism familiya').fill('OTP test owner');
 await page.locator('input[type="tel"]').fill(phone);await page.locator('input[autocomplete="username"]').fill('otp-'+randomUUID());await page.locator('input[autocomplete="new-password"]').fill(randomUUID()+'Aa1!');
 assert.equal(await page.getByRole('button',{name:'Davom etish',exact:true}).isDisabled(),true);
 const sent=page.waitForResponse(r=>r.url().endsWith('/api/auth/otp/request'));await page.getByRole('button',{name:'SMS kod yuborish',exact:true}).click();const response=await sent;assert.equal(response.status(),200);const challenge=(await response.json()).data;
 const record=(await pool.query('SELECT provider_message_id FROM auth_otp_challenges WHERE id=$1',[challenge.challengeId])).rows[0];const captured=takeTestSms(record.provider_message_id);assert.equal(captured.phone.replace(/\D/g,''),phone.replace(/\D/g,''));
 await page.getByRole('textbox',{name:'SMS kod',exact:true}).fill(captured.code==='000000'?'111111':'000000');await page.getByRole('button',{name:'Kodni tasdiqlash',exact:true}).click();await page.getByRole('alert').filter({hasText:'Kod'}).waitFor();
 await page.getByRole('textbox',{name:'SMS kod',exact:true}).fill(captured.code);await page.getByRole('button',{name:'Kodni tasdiqlash',exact:true}).click();await page.getByRole('status').filter({hasText:'Telefon tasdiqlandi'}).waitFor();
 for(const width of [320,375,430,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.auth-card,.auth-input,.auth-submit')].every(element=>element.getBoundingClientRect().right<=innerWidth+1)),true);await page.screenshot({path:path.join(out,`verified-${width}.png`),fullPage:true})}
 const registrationResponse=page.waitForResponse(r=>r.url().endsWith('/api/auth/register'));await page.getByRole('button',{name:'Davom etish',exact:true}).click();const registered=await registrationResponse;assert.equal(registered.status(),201,`registration failed: ${(await registered.json()).error?.code||registered.status()}`);await page.waitForURL('http://localhost:5186/');
 const claim=(await pool.query('SELECT o.id,o.settings FROM organization_trial_claims c JOIN organizations o ON o.id=c.organization_id ORDER BY c.claimed_at DESC LIMIT 1')).rows[0];assert.ok(claim);assert.equal(new Date(claim.settings.trialEndsAt)-new Date(claim.settings.trialStartedAt),14*86400000);
 evidence.push('Real browser → Express → disposable PostgreSQL with guarded test-only SMS capture; wrong OTP rejected; correct OTP verifies; mobile UI; atomic registration creates 14-day trial. No real handset delivery tested.');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify({passed:true,smsProvider:'TEST ONLY — live SMS BLOCKED',evidence,pageErrors:errors},null,2));console.log('OTP browser PASS (test SMS adapter only)');
}catch(error){await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify({passed:false,error:error.message,pageErrors:errors},null,2));throw error}
finally{await browser?.close();await vite?.close();await new Promise(r=>server?server.close(r):r());await pool.end()}
