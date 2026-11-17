// Local Vite production build only. All APIs are synthetic; external requests are blocked.
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {auditHeaders,observeCsp,reportPath,printCspSummary} from './helpers/cspAudit.mjs';
const server=await preview({preview:{host:'127.0.0.1',port:0,headers:auditHeaders},logLevel:'error'});
const base='http://127.0.0.1:'+server.httpServer.address().port;
let browser;
const counts=Object.create(null),probeCounts=Object.create(null);
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  async function setup({expired=false,stats=counts}={}){
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await observeCsp(context,stats);
    const requests=[],errors=[];
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin!==base)return route.abort();
      if(url.pathname===reportPath)return route.fulfill({status:204,body:''});
      if(!url.pathname.startsWith('/api/'))return route.continue();
      requests.push({path:url.pathname,method:req.method()});
      if(url.pathname==='/api/auth/me'||(expired&&url.pathname==='/api/auth/session'))
        return route.fulfill({status:401,json:{ok:false,error:{code:'UNAUTHORIZED'}}});
      let data={};
      if(url.pathname==='/api/auth/session')data={user:null};
      if(url.pathname==='/api/auth/registration-config')data={phoneVerificationRequired:false,mode:'temporary_disabled',temporaryUntil:'2099-01-01',plans:[{code:'START'},{code:'BUSINESS'},{code:'PREMIUM'}]};
      return route.fulfill({json:{ok:true,data}});
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.name));
    return {context,page,requests,errors};
  }
  const guest=await setup();
  try{
    const response=await guest.page.goto(base+'/login');
    assert.equal(response.status(),200);
    assert.equal(response.headers()['content-security-policy-report-only'],auditHeaders['Content-Security-Policy-Report-Only']);
    await expect(guest.page.getByRole('heading',{name:'Tizimga kirish'})).toBeVisible();
    await expect.poll(()=>guest.requests.filter(r=>r.path==='/api/auth/session').length).toBeGreaterThan(0);
    assert.equal(guest.requests.some(r=>r.path==='/api/auth/me'),false,'guest bootstrap must not call protected /me');
    await guest.page.goto(base+'/register');
    await expect(guest.page.locator('.auth-register-grid')).toBeVisible();
    assert.equal(guest.requests.some(r=>r.method!=='GET'),false,'audit must not submit registration');
    assert.deepEqual(guest.errors,[]);
  }finally{await guest.context.close()}
  const expired=await setup({expired:true});
  try{
    await expired.page.goto(base+'/profile');
    await expect(expired.page).toHaveURL(/\/login$/);
    await expect(expired.page.getByRole('heading',{name:'Tizimga kirish'})).toBeVisible();
    assert.ok(expired.requests.some(r=>r.path==='/api/auth/session'));
    assert.equal(expired.requests.some(r=>r.path==='/api/auth/me'),false,'401 must not be retried through /me');
    assert.deepEqual(expired.errors,[]);
  }finally{await expired.context.close()}
  // Isolated intentional violation: proves the browser delivered report-only
  // CSP and the listener works; do not count this in real route diagnostics.
  const probe=await setup({stats:probeCounts});
  try{
    await probe.page.goto(base+'/login');
    await expect(probe.page.getByRole('heading',{name:'Tizimga kirish'})).toBeVisible();
    await probe.page.evaluate(()=>{
      const script=document.createElement('script');
      script.textContent="document.documentElement.dataset.cspAuditProbe='executed'";
      document.head.append(script);
    });
    await expect(probe.page.locator('html')).toHaveAttribute('data-csp-audit-probe','executed');
    await expect.poll(()=>Object.entries(probeCounts).some(([key,count])=>/^report:script-src(?:-elem)?$/.test(key)&&count>0)).toBe(true);
  }finally{await probe.context.close()}
  console.log('PASS: report-only guest login, registration, expired-session redirect and intentional violation control');
}finally{
  printCspSummary('guest and expired session routes',counts);
  printCspSummary('intentional positive control (excluded from route counts)',probeCounts);
  if(browser)await browser.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
