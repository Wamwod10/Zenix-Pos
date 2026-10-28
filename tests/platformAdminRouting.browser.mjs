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
    const url=new URL(route.request().url());
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
    await expect(page.getByRole("heading",{name:"Platform boshqaruvi",exact:true})).toBeVisible();
    await page.waitForTimeout(100);
    assert.ok(!requested.some(path=>path.startsWith("/api/finance")||path.startsWith("/api/bootstrap")),
      `Platform admin must not request organization-scoped APIs from ${pathname}: ${requested.join(", ")}`);
  }
  // UI acceptance on mocked platform admin: filters must belong to the active tab,
  // and KPIs must not push audit/promo content down the page.
  await page.goto(new URL("/platform",base).href);
  const tabs=page.getByRole("navigation",{name:"Platforma boshqaruvi bo‘limlari"});
  await expect(tabs.getByRole("button")).toHaveCount(8);
  await expect(page.locator(".platform-pro .pro-stat-grid")).toHaveCount(3);
  await tabs.getByRole("button",{name:"Audit",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Platforma audit jurnali"})).toBeVisible();
  await expect(page.locator(".platform-pro .pro-stat-grid")).toHaveCount(0);
  await expect(page.getByText("Audit qidiruvi",{exact:true})).toBeVisible();
  await expect(page.getByPlaceholder("Biznes qidirish...")).toHaveCount(0);
  await expect(page.getByText("Biznes holati",{exact:true})).toHaveCount(0);
  await tabs.getByRole("button",{name:"Promokodlar"}).click();
  await expect(page.getByRole("heading",{name:"Promokodlarni boshqarish"})).toBeVisible();
  await expect(page.getByPlaceholder("Promokod qidirish...")).toBeVisible();
  await expect(page.getByText("Biznes holati",{exact:true})).toHaveCount(0);
  await expect(page.locator(".platform-pro .mobile-card-table")).toHaveCount(1);
  await page.setViewportSize({width:375,height:812});
  await tabs.getByRole("button",{name:"Tiklash",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Backup va tiklash nazorati"})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=1,`Platform page has horizontal overflow on mobile: ${overflow}px`);
  await expect(page.getByText("Quyidagi ro‘yxatdan biznesni",{exact:false})).toBeVisible();

  assert.deepEqual(pageErrors,[],"Platform routing must not raise uncaught browser errors");
  await context.close();
  console.log("PASS: platform admin is redirected from every organization module to /platform without tenant finance requests");
}finally{
  await browser.close();
  await server.close();
}
