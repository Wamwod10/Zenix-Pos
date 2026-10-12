import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomInt} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
const url=process.env.SUBSCRIPTION_UI_TEST_DATABASE_URL;
test('real Chromium → frontend → Express → PostgreSQL subscription acceptance',{skip:!url,timeout:120000},async t=>{
  assertSafeTestDatabaseUrl(url);assert.equal(process.env.DATABASE_URL,url);assert.equal(process.env.NODE_ENV,'test');
  const savedMode=process.env.TRIAL_PHONE_VERIFICATION_MODE,savedUntil=process.env.TRIAL_PHONE_VERIFICATION_DISABLED_UNTIL;
  process.env.TRIAL_PHONE_VERIFICATION_MODE='temporary_disabled';process.env.TRIAL_PHONE_VERIFICATION_DISABLED_UNTIL=new Date(Date.now()+3600000).toISOString();
  const [{app},{pool},{default:bcrypt},{applyBillingReview}]=await Promise.all([import('../../backend/src/app.js'),import('../../backend/src/db/pool.js'),import('../../backend/node_modules/bcryptjs/index.js'),import('../../backend/src/services/billingReview.js')]);
  const backend=app.listen(0,'127.0.0.1');await new Promise(r=>backend.once('listening',r));
  const vite=await createServer({define:{'import.meta.env.VITE_API_URL':JSON.stringify('')},server:{host:'127.0.0.1',port:0,strictPort:false,proxy:{'/api':{target:`http://127.0.0.1:${backend.address().port}`,headers:{origin:'http://localhost:5173'}}}},logLevel:'error'});
  let browser;
  try{
    await vite.listen();const base=`http://127.0.0.1:${vite.httpServer.address().port}`;
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(10000);
    const suffix=randomUUID(),username='ui-'+suffix,password='TestPassword123!';
    const org=(await pool.query("INSERT INTO organizations(name,plan_code,license_status,expiry_date,settings) VALUES('UI acceptance','START','ACTIVE','2099-01-01',jsonb_build_object('trialStartedAt',now()::text,'trialEndsAt',(now()+interval '14 days')::text)) RETURNING id,settings",[])).rows[0];
    await pool.query("INSERT INTO stores(organization_id,name) VALUES($1,'Main')",[org.id]);
    const owner=(await pool.query("INSERT INTO users(organization_id,name,username,password_hash,app_role) VALUES($1,'UI owner',$2,$3,'OWNER') RETURNING id",[org.id,username,await bcrypt.hash(password,4)])).rows[0].id;
    await page.goto(base+'/login');await page.locator('input[autocomplete=username]').fill(username);await page.locator('input[autocomplete=current-password]').fill(password);await page.locator('button[type=submit]').click();await page.waitForURL(base+'/');
    await t.test('server catalog, annual savings, mobile/tablet/desktop and both themes',async()=>{
      await page.goto(base+'/billing');await page.getByRole('button',{name:'Tarifni o‘zgartirish',exact:true}).click();await page.locator('.subscription-plan-grid input[value=START]').waitFor();
      assert.equal(await page.locator('.subscription-plan-grid .pricing-card').count(),3);
      assert.match(await page.locator('.subscription-plan-grid .pricing-card').nth(1).innerText(),/Business.*Tavsiya|Tavsiya.*Business/s);
      await page.getByRole('button',{name:'Yillik',exact:true}).click();
      assert.match(await page.locator('.subscription-plan-grid .pricing-card').nth(0).innerText(),/500[,\s]*000.*tejaysiz/);
      for(const width of [390,768,1440])for(const dark of [false,true]){
        await page.setViewportSize({width,height:1000});
        await page.waitForFunction(width=>{const rect=document.querySelector('.sidebar').getBoundingClientRect();return width<=1050?rect.right<=1:Math.abs(rect.left)<1},width);
        await page.evaluate(dark=>document.body.classList.toggle('dark-mode',dark),dark);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`overflow ${width}, dark=${dark}`);
        assert.equal(await page.locator('.subscription-plan-grid').isVisible(),true);
        const cards=await page.locator('.subscription-plan-grid .pricing-card').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
        if(width>620)assert.ok(cards[0].x<cards[1].x&&cards[1].x<cards[2].x,'Business is the middle card');
        else assert.ok(cards[0].y<cards[1].y&&cards[1].y<cards[2].y,'mobile cards stack');
        if(process.env.SUBSCRIPTION_UI_SCREENSHOT_DIR){await fs.mkdir(process.env.SUBSCRIPTION_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SUBSCRIPTION_UI_SCREENSHOT_DIR,`billing-${width}-${dark?'dark':'light'}.png`),fullPage:true});}
      }
      await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.body.classList.remove('dark-mode'));
    });
    await t.test('trial changes persist chosen plan without restarting deadline',async()=>{
      await page.locator('.subscription-plan-grid input[value=BUSINESS]').check();await page.getByRole('button',{name:'Trial tarifini almashtirish'}).click();
      await page.locator('.billing-current-title h2').filter({hasText:'Business'}).waitFor();
      const row=(await pool.query('SELECT plan_code,settings FROM organizations WHERE id=$1',[org.id])).rows[0];assert.equal(row.plan_code,'BUSINESS');assert.equal(row.settings.trialEndsAt,org.settings.trialEndsAt);
    });
    await t.test('server-priced order, genuine receipt, pending approval and paid activation',async()=>{
      await page.getByRole('button',{name:'Tarifni o‘zgartirish',exact:true}).click();await page.getByRole('button',{name:'Oylik',exact:true}).click();
      const response=page.waitForResponse(r=>r.url().endsWith('/api/billing/draft')&&r.request().method()==='POST');await page.getByRole('button',{name:'To‘lov hisobini ko‘rish'}).click();
      const draft=(await (await response).json()).data.draft;assert.equal(draft.totalAmount,350000);assert.equal(draft.planCode,'BUSINESS');
      assert.match(await page.locator('.subscription-order-summary').innerText(),/Asosiy narx.*350[,\s]*000/s);
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lAAAAABJRU5ErkJggg==','base64');
      await page.locator('input[type=file]').setInputFiles({name:'local-acceptance.png',mimeType:'image/png',buffer:png});
      const posted=page.waitForResponse(r=>r.url().endsWith('/api/billing/payments')&&r.request().method()==='POST');await page.getByRole('button',{name:'To‘lovni tekshiruvga yuborish'}).click();
      const payment=(await (await posted).json()).data.payment;assert.equal(payment.status,'REVIEW');
      assert.equal((await pool.query('SELECT count(*)::int n FROM subscription_terms WHERE organization_id=$1',[org.id])).rows[0].n,0);
      const client=await pool.connect();try{await client.query('BEGIN');await applyBillingReview(client,{paymentId:payment.id,decision:'APPROVED',actor:{id:owner,appRole:'OWNER'},reason:'Local acceptance only'});await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
      await page.goto(base+'/billing');await page.locator('.billing-current-title h2').filter({hasText:'Business'}).waitFor();
      assert.equal((await pool.query('SELECT count(*)::int n FROM subscription_terms WHERE organization_id=$1',[org.id])).rows[0].n,1);
    });
    await t.test('paid upgrade quote uses backend credit; downgrade is scheduled without immediate plan change',async()=>{
      await page.getByRole('button',{name:'Tarifni o‘zgartirish',exact:true}).click();await page.locator('.subscription-plan-grid input[value=PREMIUM]').check();
      const response=page.waitForResponse(r=>r.url().endsWith('/api/billing/draft')&&r.request().method()==='POST');await page.getByRole('button',{name:'To‘lov hisobini ko‘rish'}).click();
      const draft=(await (await response).json()).data.draft;assert.equal(draft.metadata.subscription.action,'UPGRADE');assert.ok(draft.creditAmount>0);assert.equal(draft.totalAmount,590000-draft.creditAmount);
      await page.goto(base+'/billing');await page.locator('.billing-back').click();await page.locator('.subscription-plan-grid input[value=START]').check();await page.getByRole('button',{name:'Downgrade rejalashtirish'}).click();
      await page.getByText(/START tarifi .* kuchga kiradi/).waitFor();
      const row=(await pool.query('SELECT plan_code,subscription_pending_plan FROM organizations WHERE id=$1',[org.id])).rows[0];assert.equal(row.plan_code,'BUSINESS');assert.equal(row.subscription_pending_plan,'START');
    });
    await t.test('expired workspace remains readable with explanation and backend denies business writes',async()=>{
      await pool.query("UPDATE organizations SET expiry_date='2000-01-01',settings=settings-'trialEndsAt' WHERE id=$1",[org.id]);await pool.query("UPDATE subscription_terms SET superseded_at=now() WHERE organization_id=$1",[org.id]);
      await page.goto(base+'/products');await page.getByRole('status').filter({hasText:'Faqat ko‘rish rejimi'}).waitFor();
      const response=await context.request.post(base+'/api/stores',{headers:{'x-zenix-client':'web',origin:base},data:{name:'Blocked'}});assert.equal(response.status(),402);
      await page.goto(base+'/billing');await page.locator('.subscription-usage').waitFor();assert.equal(await page.getByRole('button',{name:'To‘lov hisobini ko‘rish'}).isEnabled(),true);
    });
    await t.test('public registration offers three backend tiers without an interval requirement',async()=>{
      const guest=await browser.newContext({viewport:{width:390,height:1000}});const registration=await guest.newPage();await registration.goto(base+'/register');await registration.locator('input[value=PREMIUM]').check();
      assert.equal(await registration.locator('input[name=planCode]').count(),3);assert.equal(await registration.locator('input[name=startOption]').count(),0);assert.match(await registration.locator('.registration-options').innerText(),/14 kun/);
      assert.equal(await registration.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await registration.locator('input[placeholder*="Baraka"]').fill('Premium UI registration');await registration.locator('input[placeholder="Ism familiya"]').fill('Premium owner');
      await registration.locator('input[type=tel]').fill('+99890'+randomInt(1000000,9999999));await registration.locator('input[autocomplete=username]').fill('reg-'+suffix);await registration.locator('input[autocomplete=new-password]').fill(password);
      const registered=registration.waitForResponse(r=>r.url().endsWith('/api/auth/register')&&r.request().method()==='POST');await registration.getByRole('button',{name:'Davom etish',exact:true}).click();
      const response=await registered,result=await response.json();assert.equal(response.status(),201,JSON.stringify(result));const payload=response.request().postDataJSON();assert.equal(payload.planCode,'PREMIUM');assert.equal(payload.startOption,'TRIAL');assert.equal(payload.billingInterval,undefined);
      await registration.waitForURL(base+'/');const row=(await pool.query('SELECT plan_code,license_status,settings FROM organizations WHERE id=$1',[result.data.user.organizationId])).rows[0];assert.equal(row.plan_code,'PREMIUM');assert.equal(row.license_status,'ACTIVE');assert.equal(Date.parse(row.settings.trialEndsAt)-Date.parse(row.settings.trialStartedAt),14*86400000);
      await guest.close();
    });
    assert.deepEqual(errors,[],'browser runtime errors');await context.close();
  }finally{if(browser)await browser.close();await vite.close();await new Promise(r=>backend.close(r));await pool.end();if(savedMode===undefined)delete process.env.TRIAL_PHONE_VERIFICATION_MODE;else process.env.TRIAL_PHONE_VERIFICATION_MODE=savedMode;if(savedUntil===undefined)delete process.env.TRIAL_PHONE_VERIFICATION_DISABLED_UNTIL;else process.env.TRIAL_PHONE_VERIFICATION_DISABLED_UNTIL=savedUntil}
});
