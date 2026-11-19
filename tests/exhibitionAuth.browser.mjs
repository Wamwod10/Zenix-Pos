// Synthetic browser review of public routes; no production mutations or real accounts.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='ci-artifacts/exhibition-auth';
await mkdir(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base='http://127.0.0.1:'+server.httpServer.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const width of [320,390,1366,1920]){
    for(const route of ['login','register','reset-password']){
      const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
      try{
        await context.route('**/*',async r=>{
          const u=new URL(r.request().url());
          if(u.origin!==base)return r.abort();
          if(!u.pathname.startsWith('/api/'))return r.continue();
          assert.equal(r.request().method(),'GET');
          const data=u.pathname==='/api/auth/session'?{user:null}:u.pathname==='/api/auth/registration-config'?{phoneVerificationRequired:false,plans:[]}:{};
          return r.fulfill({json:{ok:true,data}});
        });
        const page=await context.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/'+route);
        await expect(page.locator('.auth-card')).toBeVisible();
        for(const theme of ['light','dark']){
          await page.evaluate(t=>document.body.classList.toggle('dark-mode',t==='dark'),theme);
          await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
          const metrics=await page.evaluate(()=>{
            const cs=getComputedStyle(document.body),card=document.querySelector('.auth-card'),rect=card.getBoundingClientRect(),logo=document.querySelector('.auth-brand-mark img');
            return {token:cs.getPropertyValue('--card-bg').trim(),fits:rect.left>=-1&&rect.right<=innerWidth+1,center:(rect.left+rect.right)/2,viewport:innerWidth,loaded:logo?.complete&&logo?.naturalWidth>0};
          });
          assert.ok(metrics.token,'shared palette absent on fresh direct navigation');
          assert.ok(metrics.fits,'auth card clips viewport');
          assert.ok(metrics.loaded,'brand image not loaded');
          if(route==='reset-password')assert.ok(Math.abs(metrics.center-metrics.viewport/2)<4,'recovery card not centered');
          await page.screenshot({path:out+'/'+width+'-'+route+'-'+theme+'.png',fullPage:true});
        }
        assert.deepEqual(errors,[]);
      }finally{await context.close()}
    }
  }
  console.log('PASS: 24 fresh public route/theme viewport cases');
}finally{if(browser)await browser.close();await new Promise(r=>server.httpServer.close(r))}
