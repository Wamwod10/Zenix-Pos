// Synthetic browser acceptance test. No production credentials or data are used.
// PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH optionally selects an existing Chromium.
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const output=path.resolve(process.env.ZENIX_UI_ARTIFACTS||'.cache/premium-ai');
await mkdir(output,{recursive:true});
const vite=await createServer({cacheDir:path.join(output,'.vite-browser'),server:{host:'127.0.0.1',port:0},logLevel:'error'});
await vite.listen();
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage({reducedMotion:'reduce'});
 const store='11111111-1111-4111-8111-111111111111';
 const topics=['today_sales','top_products','low_stock','dormant','profit','expenses','customer_debt','supplier_debt','branches','recommendations'];
 const questions=['Bugun qancha savdo bo‘ldi?','Eng ko‘p sotilgan mahsulotlar qaysilar?','Qaysi mahsulotlar kamaymoqda?','Qaysi tovarlar sotilmayapti?','Qaysi mahsulotlar foydali?','Xarajatlar holati qanday?','Mijozlar qarzdorligi qancha?','Ta’minotchilar qarzi qancha?','Filiallar savdosini solishtir.','Biznesim uchun tavsiyalar ber.'];
 let status={limit:100,remaining:99,enabled:true,writable:true,writesEnabled:true,planCode:'BUSINESS',suggestions:topics.map((topic,i)=>({topic,question:questions[i]}))};
 let confirmations=0,chats=0,actionStatus='PENDING',responseDelay=0,expireNext=false,lastChatBody;
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  let data={users:[],sessions:[],revision:'1'};
  if(p==='/api/auth/me')data={user:{id:'owner',organizationId:'org',appRole:'OWNER',name:'Test egasi'}};
  if(p==='/api/bootstrap')data={stores:[{id:store,name:'Asosiy filial'},{id:'22222222-2222-4222-8222-222222222222',name:'Ikkinchi filial'}],inventory:[],organization:{id:'org',planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE',storeLimit:2}};
  if(p==='/api/settings')data={selectedStoreId:store};
  if(p==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false,offset:0,limit:500}};
  if(p==='/api/ai/status')data=status;
  if(p==='/api/ai/chat'){
   chats++;
   lastChatBody=route.request().postDataJSON();
   if(expireNext){expireNext=false;return route.fulfill({status:410,contentType:'application/json',body:JSON.stringify({error:{code:'AI_CONVERSATION_EXPIRED',message:'expired'}})})}
   data={conversationId:'33333333-3333-4333-8333-333333333333',answer:'Test ma’lumotlari asosida Guruch kirimi tayyorlandi. Quyidagi ma’lumotlarni tekshiring. Tasdiqlashsiz qoldiq o‘zgarmaydi.',insights:[],actions:[{id:'test-action',type:'stock_receipt',status:actionStatus,expiresAt:new Date(Date.now()+60000).toISOString(),confirmationToken:'synthetic-test-token',preview:{productName:'Guruch (test)',warehouseName:'Asosiy ombor',storeName:'Asosiy filial',quantity:10,unit:'kg',costPrice:12000}}]};
   if(route.request().postDataJSON().question.includes('uzun'))data={...data,answer:'Test hisobotining izohi.\n'.repeat(80),actions:[]};
   if(lastChatBody.question==='Yangi erkin suhbat')data={...data,actions:[]};
   if(responseDelay)await new Promise(r=>setTimeout(r,responseDelay));
  }
  if(p.endsWith('/confirm')){confirmations++;actionStatus='CONFIRMED';await new Promise(r=>setTimeout(r,120));data={id:'test-action',status:actionStatus,result:{receiptId:'synthetic-receipt',before:0,after:10,delta:10,unit:'kg'}};}
  if(p.endsWith('/status')&&p.includes('/actions/'))data={id:'test-action',status:actionStatus};
  await route.fulfill({json:{ok:true,data}});
 });
 await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/`);
 await page.locator('.zenix-ai-trigger').click();
 const panel=page.locator('#zenix-ai-panel');
 const openMode=async mode=>{if(!(await panel.getAttribute('class')).includes(mode==='expanded'?'zenix-ai-workspace':'zenix-ai-compact'))await page.getByRole('button',{name:mode==='expanded'?'Keng workspace ochish':'Ixcham panelga o‘tish',exact:true}).click();await page.waitForFunction(m=>document.querySelector('.layout').classList.contains(`ai-${m}`),mode);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 let screens=0;
 for(const theme of ['light','dark'])for(const width of [360,390,768,1024,1366,1440,1920])for(const mode of ['expanded','compact']){
  await page.setViewportSize({width,height:width<760?844:900});
  await openMode(mode);
  await page.evaluate(dark=>document.body.classList.toggle('dark-mode',dark),theme==='dark');
  await page.locator('.zenix-ai-suggestion-cards button').first().waitFor();
  assert.equal(await page.locator('.zenix-ai-suggestion-cards button').count(),4);
  const metrics=await page.evaluate(()=>{
   const p=document.querySelector('#zenix-ai-panel').getBoundingClientRect(),c=document.querySelector('.zenix-ai-compose').getBoundingClientRect();
   const main=document.querySelector('main.content').getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth>innerWidth,panelWidth:p.width,workspaceWidth:document.querySelector('.main').getBoundingClientRect().width,panelRight:p.right,composerBottom:c.bottom,composerLeft:c.left,composerRight:c.right,mainRight:main.right};
  });
  assert.ok(!metrics.overflow,`${theme} ${width} ${mode}: horizontal overflow`);
  if(mode==='expanded')assert.ok(metrics.panelWidth>=metrics.workspaceWidth-1,`${width}: expanded AI fills the available workspace without side gutters`);
  assert.ok(metrics.composerBottom<= (width<760?844:900)+1,`${theme} ${width} ${mode}: composer below viewport`);
  assert.ok(metrics.composerLeft>=0&&metrics.composerRight<=width+1,`${theme} ${width} ${mode}: composer outside screen`);
  if(mode==='compact'&&width>1280)assert.ok(metrics.mainRight<=width-468,`${width}: dock leaves POS controls unobstructed ${JSON.stringify(metrics)}`);
  await page.screenshot({path:path.join(output,`${theme}-${mode}-${width}.png`)});screens++;
 }
 await page.setViewportSize({width:390,height:844});await openMode('compact');
 assert.equal(await page.locator('.header').evaluate(n=>n.inert),true,'full-screen drawer makes the POS background inert');
 await page.locator('#zenix-ai-question').focus();await page.keyboard.press('Tab');
 assert.ok(await page.evaluate(()=>document.querySelector('#zenix-ai-panel').contains(document.activeElement)),'mobile Tab stays inside the drawer');
 await openMode('expanded');assert.equal(await page.locator('.header').evaluate(n=>n.inert),false);await openMode('compact');
 await page.locator('.zenix-ai-suggestion-cards button').first().click();
 assert.equal(await page.locator('#zenix-ai-question').inputValue(),'Bugungi savdo natijalarini tahlil qil.');
 await page.locator('#zenix-ai-question').fill('Guruchdan omborga 10 kg qo‘sh.');
 await page.locator('#zenix-ai-question').press('Shift+Enter');assert.equal(chats,0);
 await page.locator('#zenix-ai-question').press('Enter');
 await page.locator('.zenix-ai-action').waitFor();assert.equal(confirmations,0);
 await openMode('expanded');await openMode('compact');assert.equal(await page.locator('.zenix-ai-action').count(),1);
 await page.screenshot({path:path.join(output,'dark-compact-action-390.png')});
 expireNext=true;const beforeExpired=chats;
 await page.locator('#zenix-ai-question').fill('Davom ettir');await page.locator('#zenix-ai-question').press('Enter');
 await page.getByRole('button',{name:'Yangi suhbatda davom etish',exact:true}).waitFor();assert.equal(chats,beforeExpired+1);assert.equal(confirmations,0);assert.equal(await page.locator('.zenix-ai-action').count(),1);
 await page.getByRole('button',{name:'Yangi suhbatda davom etish',exact:true}).click();assert.equal(chats,beforeExpired+1);assert.equal(await page.locator('#zenix-ai-question').inputValue(),'Davom ettir');
 await page.locator('#zenix-ai-question').fill('Yangi erkin suhbat');await page.locator('#zenix-ai-question').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#zenix-ai-question').value==='');assert.equal(lastChatBody.conversationId,null);assert.equal(confirmations,0);assert.equal(await page.locator('.zenix-ai-action').count(),1);
 const confirm=page.getByRole('button',{name:'Tasdiqlash',exact:true});await confirm.click();await page.locator('.zenix-ai-action').filter({hasText:'Bajarildi'}).waitFor();assert.equal(confirmations,1);
 await page.setViewportSize({width:1440,height:900});await openMode('expanded');
 await page.screenshot({path:path.join(output,'dark-expanded-action-1440.png')});
 await page.getByRole('button',{name:'Yangi suhbat',exact:true}).click();await page.getByRole('button',{name:'Bekor qilish',exact:true}).click();assert.equal(await page.locator('.zenix-ai-action').count(),1);
 await page.getByRole('button',{name:'Yangi suhbat',exact:true}).click();await page.getByRole('button',{name:'Yangi suhbat boshlash',exact:true}).click();assert.equal(await page.locator('.zenix-ai-action').count(),0);
 await page.locator('#zenix-ai-question').fill('Birinchi uzun hisobot');await page.locator('#zenix-ai-question').press('Enter');await page.locator('.zenix-ai-answer').waitFor();
 responseDelay=800;await page.locator('#zenix-ai-question').fill('Ikkinchi uzun hisobot');await page.locator('#zenix-ai-question').press('Enter');
 await page.locator('.zenix-ai-scroll').evaluate(n=>{n.scrollTop=0;n.dispatchEvent(new Event('scroll',{bubbles:true}))});
 await page.waitForFunction(()=>document.querySelectorAll('.zenix-ai-answer').length===2);
 assert.ok(await page.locator('.zenix-ai-scroll').evaluate(n=>n.scrollTop<50),'a delayed reply preserves readers’ position');
 await page.getByRole('button',{name:'Yangi javobga o‘tish ↓',exact:true}).click();responseDelay=0;
 await page.locator('#zenix-ai-question').fill('x'.repeat(1000));
 assert.ok(await page.locator('#zenix-ai-question').evaluate(n=>n.getBoundingClientRect().height<=160));
 await page.setViewportSize({width:360,height:520});await openMode('compact');
 assert.ok(await page.locator('.zenix-ai-compose').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight));
 await page.getByRole('button',{name:'AI panelini yopish',exact:true}).click();await page.locator('.zenix-ai-floating').click();assert.equal((await page.locator('#zenix-ai-question').inputValue()).length,1000);
 await page.locator('#zenix-ai-question').press('Escape');assert.ok(await panel.isHidden());
 await page.setViewportSize({width:720,height:450});await page.locator('.zenix-ai-trigger').click();
 assert.ok(await page.locator('.zenix-ai-compose').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight),'200% equivalent CSS viewport keeps composer in view');
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/sales`);
 await page.evaluate(()=>document.body.classList.add('dark-mode'));
 await page.locator('.checkout-primary').waitFor();await page.locator('.zenix-ai-trigger').click();await openMode('compact');
 const checkout=await page.evaluate(()=>{const p=document.querySelector('#zenix-ai-panel').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,overlap:[...document.querySelectorAll('.checkout-primary,.payment-grid button')].some(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>p.left&&r.left<p.right&&r.bottom>p.top&&r.top<p.bottom})}});
 assert.equal(checkout.overflow,false,'actual sales screen has no horizontal overflow when docked');assert.equal(checkout.overlap,false,'actual checkout and payment buttons are outside the drawer');
 await page.screenshot({path:path.join(output,'dark-compact-checkout-1440.png')});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'AI panelini yopish',exact:true}).click();
 const launcherOverlap=await page.evaluate(()=>{const p=document.querySelector('.zenix-ai-floating').getBoundingClientRect();return [...document.querySelectorAll('.pos-mobile-cart-bar,.mobile-bottom-nav,.checkout-primary')].some(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>p.left&&r.left<p.right&&r.bottom>p.top&&r.top<p.bottom})});
 assert.equal(launcherOverlap,false,'launcher leaves mobile checkout/navigation controls clear');
 status={...status,enabled:false,limit:0,remaining:0};await page.setViewportSize({width:360,height:844});await page.reload();await page.locator('.zenix-ai-trigger').click();
 await page.getByText('ZENIX AI hozircha faollashtirilmagan.',{exact:true}).waitFor();assert.ok(await page.locator('#zenix-ai-question').isDisabled());assert.equal(await page.locator('.zenix-ai-notice a').count(),0);
 await page.screenshot({path:path.join(output,'provider-off-360.png')});
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${screens} light/dark viewport/mode screenshots; composer, suggestions, shared actions, reset confirmation, reader-safe scroll, focus/inert, short/zoom-equivalent viewports, real Sales checkout/launcher separation, OFF state, zero page errors.`);
}finally{await browser?.close();await vite.close();}
