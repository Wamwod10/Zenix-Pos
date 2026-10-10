import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {randomUUID,randomInt} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {takeTestSms} from '../../backend/src/services/smsProvider.js';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL,{nodeEnv:process.env.NODE_ENV});
assert.equal(process.env.DATABASE_URL,process.env.TEST_DATABASE_URL);
process.env.SMS_PROVIDER='test';process.env.OTP_HMAC_SECRET=randomUUID()+randomUUID();
process.env.FRONTEND_ORIGIN='http://localhost:5184';process.env.VITE_API_URL='http://localhost:5190';
const [{app},{pool},{default:bcrypt}]=await Promise.all([import('../../backend/src/app.js'),import('../../backend/src/db/pool.js'),import('../../backend/node_modules/bcryptjs/index.js')]);
const out=path.resolve('../artifacts/final-saas');await fs.mkdir(out,{recursive:true});
let browser,vite,server;const evidence=[],errors=[];
evidence.push=(...items)=>{console.log('SaaS: '+items.join('; '));return Array.prototype.push.apply(evidence,items)};
const base='http://localhost:5184';
async function request(page,url,body,expected=200){
 const result=await page.evaluate(async({url,body})=>{const r=await fetch('http://localhost:5190'+url,{credentials:'include',method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-Zenix-Client':'web'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()}},{url,body});
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
function uniquePng(png){
 const data=Buffer.from('Fixture\0'+randomUUID()),type=Buffer.from('tEXt'),content=Buffer.concat([type,data]);let crc=0xffffffff;
 for(const byte of content){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 const length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);
 return Buffer.concat([png.subarray(0,-12),length,content,checksum,png.subarray(-12)]);
}
async function upload(page,png){
 const result=await page.evaluate(async bytes=>{const body=Uint8Array.from(atob(bytes),char=>char.charCodeAt(0));const r=await fetch('http://localhost:5190/api/billing/receipts',{method:'POST',credentials:'include',headers:{'Content-Type':'image/png','X-Zenix-Client':'web','X-File-Name':'disposable.png'},body});return {status:r.status,payload:await r.json()}},uniquePng(png).toString('base64'));
 assert.equal(result.status,201);return result.payload.data.receipt.id;
}
try{
 const tenant=await makeTenant(),cashier=await makeTenant('CASHIER');
 const admin={username:'platform-'+randomUUID(),password:randomUUID()+'Aa1!'};
 admin.user=(await pool.query("INSERT INTO users(name,username,password_hash,app_role) VALUES('SaaS platform admin',$1,$2,'PLATFORM_ADMIN') RETURNING id",[admin.username,await bcrypt.hash(admin.password,10)])).rows[0].id;
 server=app.listen(5190,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 vite=await createServer({server:{host:'127.0.0.1',port:5184,strictPort:true,hmr:false,watch:null}});await vite.listen();
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const ownerContext=await browser.newContext({viewport:{width:1440,height:1000}}),adminContext=await browser.newContext(),cashierContext=await browser.newContext();
 const owner=await ownerContext.newPage(),platform=await adminContext.newPage(),cash=await cashierContext.newPage();
 for(const page of [owner,platform,cash])page.on('pageerror',error=>errors.push(error.message));
 await login(owner,tenant.username,tenant.password);await login(platform,admin.username,admin.password);await login(cash,cashier.username,cashier.password);
 await platform.waitForURL(base+'/platform');await platform.locator('.platform-toolbar').waitFor();
 await request(owner,'/api/platform/overview',undefined,403);await request(cash,'/api/platform/overview',undefined,403);await request(platform,'/api/platform/overview');
 await owner.goto(base+'/platform');await owner.waitForURL(base+'/');evidence.push('platform admin browser login; owner/cashier real API denial and owner route redirect');
 for(let i=0;i<21;i++)await pool.query("INSERT INTO audit_logs(organization_id,user_id,action,entity_type,title,metadata) VALUES($1,$2,'api_error','request',$3,$4)",[tenant.org,tenant.user,'SaaS diagnostic '+i,{status:500,requestId:'fixture-'+i}]);
 const support1=(await request(platform,`/api/platform/organizations/${tenant.org}/support?limit=20&offset=0`)).support;
 const support2=(await request(platform,`/api/platform/organizations/${tenant.org}/support?limit=20&offset=20`)).support;
 assert.equal(support1.apiIssues.length,20);assert.equal(support1.hasMore.api,true);assert.equal(support2.apiIssues.length,1);assert.equal(support2.hasMore.api,false);
 const recovery=await request(platform,`/api/platform/organizations/${tenant.org}/recovery-preview`);assert.equal(recovery.restoreAvailable,false);assert.equal(recovery.backupsAvailable,false);
 evidence.push('support exact 20+1 paging; recovery explicitly unavailable without provider');
 await owner.goto(base+'/billing');await owner.getByRole('button',{name:'Mavzu',exact:true}).click();
 assert.equal(await owner.evaluate(()=>document.body.classList.contains('dark-mode')),true);
 await owner.route('**/api/settings',async route=>{await new Promise(resolve=>setTimeout(resolve,600));await route.continue()});
 await owner.reload();await owner.getByRole('button',{name:'Mavzu',exact:true}).waitFor();await owner.waitForTimeout(900);assert.equal(await owner.evaluate(()=>document.body.classList.contains('dark-mode')),true);
 const tab2=await ownerContext.newPage();await tab2.goto(base+'/billing');await tab2.getByRole('button',{name:'Mavzu',exact:true}).waitFor();assert.equal(await tab2.evaluate(()=>document.body.classList.contains('dark-mode')),true);
 await owner.getByRole('button',{name:'Mavzu',exact:true}).click();await tab2.waitForFunction(()=>!document.body.classList.contains('dark-mode'));
 await owner.setViewportSize({width:375,height:850});await owner.reload();await owner.getByRole('button',{name:'Mavzu',exact:true}).waitFor();assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 evidence.push('manual theme persists delayed bootstrap; two-tab theme synchronization; mobile refresh');
 await owner.setViewportSize({width:1440,height:1000});
 await logout(owner);
 await owner.waitForURL(base+'/login');await tab2.waitForURL(base+'/login');
 await login(owner,cashier.username,cashier.password);await tab2.locator('.profile-trigger').filter({hasText:'SaaS CASHIER'}).waitFor();
 await logout(owner);await tab2.waitForURL(base+'/login');await login(owner,tenant.username,tenant.password);await tab2.locator('.profile-trigger').filter({hasText:'SaaS OWNER'}).waitFor();
 await owner.evaluate(user=>localStorage.setItem(`zenix:theme:v1:${user}`,'system'),tenant.user);await owner.emulateMedia({colorScheme:'dark'});await owner.reload();await owner.waitForFunction(()=>document.body.classList.contains('dark-mode'));await owner.emulateMedia({colorScheme:'light'});await owner.waitForFunction(()=>!document.body.classList.contains('dark-mode'));
 evidence.push('two-tab logout/login and different-user identity sync; system theme responds to OS preference');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
 // Real browser transport exercises the authoritative promo transaction matrix.
 for(const plan of ['MONTHLY','ANNUAL'])for(const percent of [20,50,75,100]){
   console.log(`SaaS promo UI: ${plan} ${percent}%`);
   const code='FINAL-'+randomUUID().slice(0,12).toUpperCase();
   await request(platform,'/api/platform/promos',{code,plan,percent,maxUses:2,perBusiness:2},201);
   const preview=(await request(owner,'/api/billing/promo/preview',{code,plan})).promo;
   assert.equal(preview.percent,percent);assert.equal(preview.due,(plan==='MONTHLY'?350000:3300000)*(100-percent)/100);
   await owner.goto(base+'/billing');await owner.getByRole('button',{name:'Tarifni o‘zgartirish',exact:true}).click();await owner.locator('.pricing-card').filter({hasText:plan==='MONTHLY'?'Oylik':'Yillik'}).click();await owner.getByPlaceholder('ZENIX-FREE30').fill(code);await owner.getByRole('button',{name:'Promokodni tekshirish',exact:true}).click();await owner.locator('.pricing-section .pro-alert.success').waitFor();assert.ok((await owner.locator('.pricing-section .pro-alert.success').textContent()).includes(`${percent}%`));
   if(percent===100){
     const activated=owner.waitForResponse(r=>r.url().endsWith('/api/billing/promo/redeem-free'));await owner.getByRole('button',{name:'Bepul faollashtirish',exact:true}).click();const activation=await activated;assert.equal(activation.status(),200);const first=(await activation.json()).data,requestId=activation.request().postDataJSON().requestId;
     await request(owner,'/api/billing/promo/redeem-free',{code,plan,requestId});
     const rows=await pool.query('SELECT amount,status,receipt_id FROM billing_payments WHERE id=$1',[first.subscription.paymentId]);
     assert.equal(Number(rows.rows[0].amount),0);assert.equal(rows.rows[0].status,'APPROVED');assert.equal(rows.rows[0].receipt_id,null);
   }else{
     await owner.getByRole('button',{name:'Davom etish',exact:true}).click();await owner.locator('.billing-checkout-card').waitFor();const draft=(await request(owner,'/api/billing/draft')).draft;
     assert.equal(draft.totalAmount,preview.due);await owner.locator('input[type="file"]').setInputFiles({name:'promo-receipt.png',mimeType:'image/png',buffer:uniquePng(png)});
     const sent=owner.waitForResponse(r=>r.url().endsWith('/api/billing/payments')&&r.request().method()==='POST');await owner.locator('.payment-submit').click();const submitted=await sent;const payment=(await submitted.json()).data.payment;assert.equal(submitted.status(),201);assert.equal(payment.amount,preview.due);
     assert.equal((await pool.query('SELECT status FROM platform_promo_reservations WHERE payment_id=$1',[payment.id])).rows[0].status,'RESERVED');
     await request(platform,`/api/platform/payments/${payment.id}/review`,{status:'APPROVED'});assert.equal((await pool.query('SELECT status FROM platform_promo_reservations WHERE payment_id=$1',[payment.id])).rows[0].status,'CONSUMED');
   }
 }
 evidence.push('monthly/yearly 20/50/75/100% actual promo UI; paid checkout/upload and reservation approval; zero-price UI activation replay');
 const other=await makeTenant(),otherContext=await browser.newContext(),otherPage=await otherContext.newPage();await login(otherPage,other.username,other.password);
 const raceCode='RACE-'+randomUUID().slice(0,12).toUpperCase();await request(platform,'/api/platform/promos',{code:raceCode,plan:'BOTH',percent:100,maxUses:5,perBusiness:1},201);
 const redeem=page=>page.evaluate(async code=>{const r=await fetch('http://localhost:5190/api/billing/promo/redeem-free',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Zenix-Client':'web'},body:JSON.stringify({code,plan:'MONTHLY',requestId:crypto.randomUUID()})});return r.status},raceCode);
 assert.deepEqual(await Promise.all([redeem(owner),redeem(otherPage)]),[200,200]);
 await request(owner,'/api/billing/promo/redeem-free',{code:raceCode,plan:'MONTHLY',requestId:randomUUID()},409);
 assert.equal((await pool.query('SELECT used_count FROM platform_promos WHERE code=$1',[raceCode])).rows[0].used_count,2);
 const oneCode='ONE-'+randomUUID().slice(0,12).toUpperCase();await request(platform,'/api/platform/promos',{code:oneCode,plan:'BOTH',percent:100,maxUses:1,perBusiness:1},201);
 const oneRedeem=page=>page.evaluate(async code=>{const r=await fetch('http://localhost:5190/api/billing/promo/redeem-free',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Zenix-Client':'web'},body:JSON.stringify({code,plan:'ANNUAL',requestId:crypto.randomUUID()})});return r.status},oneCode);
 assert.deepEqual((await Promise.all([oneRedeem(owner),oneRedeem(otherPage)])).sort(),[200,409]);assert.equal((await pool.query('SELECT used_count FROM platform_promos WHERE code=$1',[oneCode])).rows[0].used_count,1);
 const expiredCode='OLD-'+randomUUID().slice(0,12).toUpperCase();await request(platform,'/api/platform/promos',{code:expiredCode,plan:'BOTH',percent:50,maxUses:2,perBusiness:1,expiresAt:new Date(Date.now()-1000).toISOString()},201);await request(owner,'/api/billing/promo/preview',{code:expiredCode,plan:'MONTHLY'},409);
 const cancelCode='CANCEL-'+randomUUID().slice(0,10).toUpperCase();await request(platform,'/api/platform/promos',{code:cancelCode,plan:'BOTH',percent:50,maxUses:1,perBusiness:1},201);
 const cancelled=(await request(owner,'/api/billing/draft',{type:'LICENSE',intent:'ACTIVATE',plan:'MONTHLY',promoCode:cancelCode},201)).draft;await request(owner,`/api/billing/draft/${cancelled.id}/cancel`,{});assert.equal((await pool.query('SELECT status FROM billing_drafts WHERE id=$1',[cancelled.id])).rows[0].status,'cancelled');await request(otherPage,'/api/billing/promo/preview',{code:cancelCode,plan:'MONTHLY'});
 const reservedDraft=(await request(owner,'/api/billing/draft',{type:'LICENSE',intent:'ACTIVATE',plan:'MONTHLY',promoCode:cancelCode},201)).draft;
 const pending=(await request(owner,'/api/billing/payments',{draftId:reservedDraft.id,receiptId:await upload(owner,png)},201)).payment;await request(otherPage,'/api/billing/promo/preview',{code:cancelCode,plan:'MONTHLY'},409);
 await request(platform,`/api/platform/payments/${pending.id}/review`,{status:'REJECTED',reason:'Disposable reservation release check'});assert.equal((await pool.query('SELECT status FROM platform_promo_reservations WHERE payment_id=$1',[pending.id])).rows[0].status,'RELEASED');await request(otherPage,'/api/billing/promo/preview',{code:cancelCode,plan:'MONTHLY'});
 const expiredDraft=(await request(owner,'/api/billing/draft',{type:'LICENSE',intent:'ACTIVATE',plan:'MONTHLY',promoCode:cancelCode},201)).draft;await pool.query("UPDATE billing_drafts SET expires_at=now()-interval '1 second' WHERE id=$1",[expiredDraft.id]);await request(owner,'/api/billing/payments',{draftId:expiredDraft.id,receiptId:await upload(owner,png)},409);await otherContext.close();
 evidence.push('browser transport global one-use race; per-business limit; expired promo/draft rejection; cancellation and rejected reservation preserve capacity');
 // Actual branch checkout UI, file upload, server quote and concurrent review.
 for(const [duration,label,expected] of [['MONTHLY','1 oy',120000],['ANNUAL','1 yil',1100000],['UNTIL_LICENSE','Asosiy tarif tugaguncha (oyma-oy)',null]]){
   await owner.goto(base+'/billing');await owner.getByRole('button',{name:'+ Filial limiti',exact:true}).click();await owner.locator('.billing-checkout-card').waitFor();
   if(duration!=='UNTIL_LICENSE'){
     await owner.locator('.billing-checkout-card .premium-select').click();const repriced=owner.waitForResponse(r=>r.url().endsWith('/api/billing/draft')&&r.request().method()==='POST');await owner.getByRole('option',{name:label,exact:true}).click();assert.equal((await repriced).status(),201);
   }
   await owner.locator('.billing-checkout-card .premium-select').waitFor({state:'visible'});
   const draft=(await request(owner,'/api/billing/draft')).draft;assert.equal(draft.metadata.extraDuration,duration);if(expected!==null)assert.equal(draft.totalAmount,expected);assert.ok(draft.totalAmount>0);
   await owner.locator('input[type="file"]').setInputFiles({name:'local-test-receipt.png',mimeType:'image/png',buffer:uniquePng(png)});
   const submitted=owner.waitForResponse(r=>r.url().endsWith('/api/billing/payments')&&r.request().method()==='POST');await owner.locator('.payment-submit').click();const response=await submitted;const payload=await response.json();assert.equal(response.status(),201,JSON.stringify(payload));const payment=payload.data.payment;assert.equal(payment.amount,draft.totalAmount);
   const approvals=await platform.evaluate(async id=>Promise.all([1,2].map(async()=>{const r=await fetch(`http://localhost:5190/api/platform/payments/${id}/review`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Zenix-Client':'web'},body:JSON.stringify({status:'APPROVED'})});return r.status})),payment.id);
   assert.deepEqual(approvals.sort(),[200,409]);
   const pass=(await pool.query('SELECT * FROM extra_store_entitlements WHERE payment_id=$1',[payment.id])).rows;
   assert.equal(pass.length,1);assert.equal(pass[0].duration,duration);assert.equal(Number(pass[0].quantity),1);
 }
 evidence.push('three branch options actual browser checkout/upload; exact month/year amounts, until-license quote; concurrent admin approval creates one entitlement');
 const trialContext=await browser.newContext({extraHTTPHeaders:{'X-Forwarded-For':'192.0.2.'+randomInt(1,250)}}),trialPage=await trialContext.newPage();
 await trialPage.goto(base+'/register');await trialPage.getByText('14 kun bepul sinab ko‘rish',{exact:true}).waitFor();
 await trialPage.getByPlaceholder('Masalan: Baraka Market').fill('Final trial '+randomUUID());await trialPage.getByPlaceholder('Ism familiya').fill('Trial owner');await trialPage.locator('input[type="tel"]').fill('99890'+randomInt(1000000,10000000));await trialPage.locator('input[autocomplete="username"]').fill('trial-'+randomUUID());await trialPage.locator('input[autocomplete="new-password"]').fill(randomUUID()+'Cc3!');
 const otpSent=trialPage.waitForResponse(r=>r.url().endsWith('/api/auth/otp/request'));await trialPage.getByRole('button',{name:'SMS kod yuborish',exact:true}).click();const otpResponse=await otpSent;assert.equal(otpResponse.status(),200);const otpChallenge=(await otpResponse.json()).data;const otpRow=(await pool.query('SELECT provider_message_id FROM auth_otp_challenges WHERE id=$1',[otpChallenge.challengeId])).rows[0];const otpCapture=takeTestSms(otpRow.provider_message_id);await trialPage.getByRole('textbox',{name:'SMS kod',exact:true}).fill(otpCapture.code);await trialPage.getByRole('button',{name:'Kodni tasdiqlash',exact:true}).click();await trialPage.getByRole('status').filter({hasText:'Telefon tasdiqlandi'}).waitFor();
 await trialPage.getByRole('button',{name:'Davom etish',exact:true}).click();await trialPage.waitForURL(base+'/');
 const registered=(await request(trialPage,'/api/auth/me')).user;
 const trialRow=(await pool.query('SELECT created_at,settings FROM organizations WHERE id=$1',[registered.organizationId])).rows[0];
 assert.equal(Date.parse(trialRow.settings.trialEndsAt)-Date.parse(trialRow.settings.trialStartedAt),14*86400000);assert.ok(Math.abs(Date.parse(trialRow.settings.trialStartedAt)-Date.parse(trialRow.created_at))<2000);
 await trialPage.goto(base+'/billing');await trialPage.getByText('14 kunlik sinov muddati',{exact:true}).waitFor();await trialPage.locator('progress[aria-label="Sinov muddati"]').waitFor();
 const time=await trialPage.locator('.billing-renewal-reminder small').first().textContent();await trialPage.waitForTimeout(1100);assert.notEqual(await trialPage.locator('.billing-renewal-reminder small').first().textContent(),time);
 await pool.query("UPDATE organizations SET settings=jsonb_set(settings,'{trialEndsAt}',to_jsonb((now()-interval '1 second')::text)) WHERE id=$1",[registered.organizationId]);
 await trialPage.goto(base+'/sales');await trialPage.getByRole('alert').filter({hasText:/cheklangan/}).waitFor();await trialPage.goto(base+'/activation');await request(trialPage,'/api/products',undefined,402);
 const trialPromo='TRIAL-'+randomUUID().slice(0,12).toUpperCase();await request(platform,'/api/platform/promos',{code:trialPromo,plan:'BOTH',percent:100,maxUses:1,perBusiness:1},201);await trialPage.getByPlaceholder('ZENIX-FREE30').fill(trialPromo);await trialPage.getByRole('button',{name:'Promokodni tekshirish',exact:true}).click();await trialPage.getByRole('button',{name:'Bepul faollashtirish',exact:true}).click();await trialPage.waitForURL(base+'/');await request(trialPage,'/api/products');assert.equal((await pool.query('SELECT settings FROM organizations WHERE id=$1',[registered.organizationId])).rows[0].settings.trialEndsAt,undefined);
 await request(platform,`/api/platform/organizations/${tenant.org}/control`,{action:'PAYWALL',reason:'Local SaaS payment hold fixture'});await owner.goto(base+'/sales');await owner.getByRole('alert').filter({hasText:/cheklangan/}).waitFor();await request(owner,'/api/products',undefined,402);await request(owner,'/api/billing/draft');
 await request(platform,`/api/platform/organizations/${tenant.org}/control`,{action:'RELEASE_PAYWALL',reason:'Local SaaS payment hold release'});
 await request(platform,`/api/platform/organizations/${tenant.org}/control`,{action:'SUSPEND',reason:'Local SaaS ordinary suspension fixture'});await request(owner,'/api/billing/draft',undefined,401);
 await request(platform,`/api/platform/organizations/${tenant.org}/control`,{action:'RESTORE',reason:'Local SaaS ordinary suspension release'});await login(owner,tenant.username,tenant.password);await owner.goto(base+'/billing');await trialContext.close();
 evidence.push('visible registration 14-day trial/server countdown; expired trial blocks sales and real free checkout reactivates; payment hold preserves billing while ordinary suspension denies it');
 for(const target of [tenant,cashier]){
   const sessionPage=target===tenant?owner:cash;
   const reset=(await request(platform,`/api/platform/organizations/${target.org}/users/${target.user}/reset-token`,{reason:'Local browser identity verification fixture',identityVerified:true},201)).reset;
   const resetContext=await browser.newContext(),page=await resetContext.newPage();await page.goto(base+'/reset-password');
   await page.locator('input').nth(0).fill(reset.token);const newPassword=randomUUID()+'Bb2!';await page.locator('input[type="password"]').nth(0).fill(newPassword);await page.locator('input[type="password"]').nth(1).fill(newPassword);await page.locator('button').filter({hasText:/Yangi parol/}).click();await page.getByRole('status').waitFor();
   await request(sessionPage,'/api/auth/me',undefined,401);await request(page,'/api/auth/reset-password',{token:reset.token,password:newPassword},400);await login(page,target.username,newPassword);
   const expired=(await request(platform,`/api/platform/organizations/${target.org}/users/${target.user}/reset-token`,{reason:'Local browser expiry verification fixture',identityVerified:true},201)).reset;
   await pool.query("UPDATE password_reset_tokens SET expires_at=now()-interval '1 second' WHERE user_id=$1 AND consumed_at IS NULL",[target.user]);
   await request(page,'/api/auth/reset-password',{token:expired.token,password:newPassword},400);
   await resetContext.close();
 }
 evidence.push('platform-issued owner/cashier reset UI; one use, expiry, previous session revoked and new login');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify({evidence,errors,remaining:['Real backup credentials and restore drill absent','Phone identity verification absent']},null,2));console.log(JSON.stringify(evidence));
}catch(error){console.error(error.message);for(const [c,context] of (browser?.contexts()||[]).entries())for(const [i,page] of context.pages().entries())await page.screenshot({path:path.join(out,`failure-${c}-${i}.png`),fullPage:true,timeout:5000}).catch(()=>{});throw error}
finally{await browser?.close();await vite?.close();if(server)await new Promise(resolve=>server.close(resolve));await pool.end()}
