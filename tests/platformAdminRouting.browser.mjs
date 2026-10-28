// Mock-only platform routing acceptance. No real credentials, finance API or production writes.
import assert from "node:assert/strict";
import {chromium,expect} from "@playwright/test";
import {createServer} from "vite";

const server=await createServer({server:{host:"127.0.0.1",port:0},logLevel:"error"});
await server.listen();
const base=server.resolvedUrls.local[0];
const browser=await chromium.launch();
try{
  const context=await browser.newContext({serviceWorkers:"block",viewport:{width:1366,height:900}});
  const page=await context.newPage();
  const requested=[],pageErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url);
    requested.push(url.pathname);
    let data={};
    if(url.pathname==="/api/auth/me"){
      data={user:{id:"platform-routing-fixture",name:"Synthetic Platform Administrator",appRole:"PLATFORM_ADMIN",organizationId:null,forcePasswordChange:false}};
    }else if(url.pathname==="/api/platform/overview"){
      data={overview:{organizations:0,active:0,review:0,stores:0}};
    }else if(url.pathname.startsWith("/api/platform/")){
      data={items:[],organizations:[],payments:[],total:0,hasMore:false};
    }else if(url.pathname.startsWith("/api/finance")||url.pathname.startsWith("/api/bootstrap")){
      return route.fulfill({status:403,json:{ok:false,error:{code:"FORBIDDEN",message:"Tenant finance forbidden to platform admin"}}});
    }
    return route.fulfill({json:{ok:true,data}});
  });
  for(const pathname of ["/","/analytics","/sales","/inventory","/products","/platform"]){
    requested.length=0;
    await page.goto(new URL(pathname,base).href);
    await expect(page).toHaveURL(/\/platform$/,{timeout:12000});
    await expect(page.getByText("Platform boshqaruvi",{exact:true})).toBeVisible();
    await page.waitForTimeout(100);
    assert.ok(!requested.some(path=>path.startsWith("/api/finance")||path.startsWith("/api/bootstrap")),
      `Platform admin must not request organization-scoped APIs from ${pathname}: ${requested.join(", ")}`);
  }
  assert.deepEqual(pageErrors,[],"Platform routing must not raise uncaught browser errors");
  await context.close();
  console.log("PASS: platform admin is redirected from every organization module to /platform without tenant finance requests");
}finally{
  await browser.close();
  await server.close();
}
