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
    }else if(url.pathname==="/api/platform/organizations/org-synthetic-platform-1/detail"){
      data={organization:{id:"org-synthetic-platform-1",name:"Sinov biznesi — juda uzun kompaniya nomi",owner:"Test egasi",phone:"+998901234567",stores:3,plan:"MONTHLY",licenseStatus:"ACTIVE",expiryDate:"2027-12-31",billingHold:false,users:[{id:"user-synthetic-1",name:"Test kassir",username:"test-cashier",phone:"+998901234567",role:"CASHIER",active:true}],storeRows:[]},payments:[]};
    }else if(url.pathname==="/api/platform/organizations/page"){
      data={items:[{id:"org-synthetic-platform-1",name:"Sinov biznesi — juda uzun kompaniya nomi",owner:"Test egasi",phone:"+998901234567",stores:3,plan:"MONTHLY",licenseStatus:"ACTIVE",expiryDate:"2027-12-31",billingHold:false}],total:1,hasMore:false};
    }else if(url.pathname==="/api/platform/payments/page"){
      data={items:[{id:"synthetic-pay-review-1",orderId:"SYNTHETIC-ORDER-2026",organization:"Sinov biznesi",submittedAt:"2026-10-28T09:00:00Z",purpose:"Obuna to‘lovi",amount:150000,status:"REVIEW",receiptId:null}],total:1,hasMore:false};
    }else if(url.pathname==="/api/platform/promos"){
      data={promos:[{id:"synthetic-promo-1",code:"ZENIX-SYNTHETIC-2026",plan:"BOTH",percent:50,uses:2,maxUses:10,reserved:1,remaining:7,perBusiness:1,active:true,startsAt:"2026-10-01",expiresAt:"2027-12-31"}],total:1};
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
  await expect(page.getByRole("button",{name:"Kurslar",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Tezkor klaviatura",exact:true})).toHaveCount(0);
  const tabs=page.getByRole("navigation",{name:"Platforma boshqaruvi bo‘limlari"});
  await expect(tabs.getByRole("button")).toHaveCount(8);
  await expect(page.locator(".platform-pro .pro-stat-grid")).toHaveCount(1);
  await page.getByRole("button",{name:"Yana 7 ta ko‘rsatkichni ko‘rish"}).click();
  await expect(page.locator(".platform-pro .pro-stat-grid")).toHaveCount(3);
  await tabs.getByRole("button",{name:"Audit",exact:true}).click();
  await expect(page).toHaveURL(/section=audit/);
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
  await expect(page.locator(".platform-pro .mobile-card-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".platform-pro .mobile-card-table tbody tr").first().getByText("Oylik va yillik",{exact:true})).toBeVisible();
  await page.setViewportSize({width:375,height:812});
  await expect(page.locator(".platform-pro .mobile-card-table tbody tr td[data-label='Kod']")).toBeVisible();
  await tabs.getByRole("button",{name:"Boshqaruv",exact:true}).click();
  const kpiGrid=page.locator(".platform-pro > .pro-stat-grid").first();
  await expect(kpiGrid).toBeVisible();
  for(const theme of ["light","dark"]){
    await page.evaluate(next=>document.body.classList.toggle("dark-mode",next==="dark"),theme);
    const columns=await kpiGrid.evaluate(node=>getComputedStyle(node).gridTemplateColumns.trim().split(" ").filter(Boolean).length);
    assert.equal(columns,2,`375px ${theme}: primary KPIs must use two columns`);
  }
  await page.evaluate(()=>document.body.classList.remove("dark-mode"));
  await tabs.getByRole("button",{name:"Promokodlar",exact:true}).click();
  await tabs.getByRole("button",{name:"To‘lovlar",exact:true}).click();
  await expect(page.getByRole("heading",{name:"To‘lovlarni tekshirish"})).toBeVisible();
  await expect(page.getByRole("button",{name:"To‘lovni tasdiqlash"})).toBeVisible();
  await expect(page.getByRole("button",{name:"To‘lovni rad etish"})).toBeVisible();
  await tabs.getByRole("button",{name:"Mijozlar",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Mijozlar ro‘yxati"})).toBeVisible();
  await expect(page.getByText("Sinov biznesi — juda uzun kompaniya nomi",{exact:true})).toBeVisible();
  assert.equal(await page.getByPlaceholder("Promokod qidirish...").count(),0,"Switching admin tabs must reset context-specific search");
  await page.getByRole("button",{name:"Tashkilotni ko‘rish"}).click();
  const detail=page.getByRole("dialog",{name:"Sinov biznesi — juda uzun kompaniya nomi"});
  await expect(detail).toBeVisible();
  const detailTabs=detail.getByRole("tablist",{name:"Mijoz tafsilotlari bo‘limlari"});
  await expect(detailTabs.getByRole("tab")).toHaveCount(7);
  await expect(detail.locator(".platform-customer-kpis > div")).toHaveCount(3);
  const detailKpis=detail.locator(".platform-customer-kpis");
  const inspectDetailLayout=async(width,height,expectedColumns,theme)=>{
    await page.setViewportSize({width,height});
    await page.evaluate(next=>document.body.classList.toggle("dark-mode",next==="dark"),theme);
    const metrics=await detail.evaluate(el=>{
      const grid=el.querySelector(".platform-customer-kpis");
      const close=el.querySelector(".pro-modal-head [aria-label='Yopish']");
      const bounds=el.getBoundingClientRect(),closeBounds=close.getBoundingClientRect();
      return {columns:getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
        overflow:el.scrollWidth-el.clientWidth,closeInside:closeBounds.right<=bounds.right+1&&closeBounds.left>=bounds.left-1};
    });
    assert.equal(metrics.columns,expectedColumns,`customer modal ${width}px/${theme}: KPI columns`);
    assert.ok(metrics.overflow<=2,`customer modal ${width}px/${theme}: horizontal overflow ${metrics.overflow}`);
    assert.ok(metrics.closeInside,`customer modal ${width}px/${theme}: close button outside modal`);
  };
  await inspectDetailLayout(320,740,1,"light");
  await inspectDetailLayout(375,812,2,"dark");
  await inspectDetailLayout(1366,900,3,"light");
  await page.setViewportSize({width:375,height:812});
  await page.evaluate(()=>document.body.classList.remove("dark-mode"));
  await detailTabs.getByRole("tab",{name:"Umumiy",exact:true}).focus();
  await page.keyboard.press("ArrowRight");
  await expect(detailTabs.getByRole("tab",{name:"Tarif",exact:true})).toHaveAttribute("aria-selected","true");
  await detailTabs.getByRole("tab",{name:"Xodimlar",exact:true}).click();
  await expect(detail.getByText("Test kassir")).toBeVisible();
  await detail.getByRole("button",{name:"Parolni tiklash",exact:true}).click();
  const reset=page.getByRole("dialog",{name:"Xodim parolini tiklash"});
  await expect(reset).toBeVisible();
  const overlayTop=await page.evaluate(()=>{
    const dialogs=[...document.querySelectorAll('.pro-modal-backdrop .pro-modal')];
    return dialogs.at(-1)?.getAttribute('aria-label');
  });
  assert.equal(overlayTop,"Xodim parolini tiklash","Password reset must be the topmost nested modal");
  await expect(reset.getByRole("button",{name:"Bir martalik token"})).toHaveAttribute("aria-pressed","true");
  await expect(reset.getByLabel("Vaqtinchalik parol (kamida 12 belgi)")).toHaveCount(0);
  await reset.getByRole("button",{name:"Administrator parol beradi"}).click();
  await expect(reset.getByLabel("Vaqtinchalik parol (kamida 12 belgi)")).toBeVisible();
  await expect(reset.getByRole("button",{name:"Token yaratish"})).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(reset).toHaveCount(0);
  await expect(detail).toBeVisible();
  await detailTabs.getByRole("tab",{name:"Tarif",exact:true}).click();
  await expect(detail.getByRole("heading",{name:"Biznes va tarif boshqaruvi"})).toBeVisible();
  await expect(detail.getByText("Test kassir")).toHaveCount(0);
  await detailTabs.getByRole("tab",{name:"Umumiy",exact:true}).click();
  await expect(detail.locator(".platform-customer-kpis > div")).toHaveCount(3);
  await detail.getByRole("button",{name:"Yopish"}).click();

  await tabs.getByRole("button",{name:"Saqlash",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Saqlash diagnostikasi"})).toBeVisible();
  await page.getByRole("button",{name:"Saqlash hajmini ko‘rish"}).click();
  const storageDetail=page.getByRole("dialog",{name:"Sinov biznesi — juda uzun kompaniya nomi"});
  await expect(storageDetail.getByRole("tab",{name:"Diagnostika"})).toHaveAttribute("aria-selected","true");
  await expect(storageDetail.getByRole("heading",{name:"Saqlash hajmi"})).toBeVisible();
  await storageDetail.getByRole("button",{name:"Yopish"}).click();
  await tabs.getByRole("button",{name:"Yordam",exact:true}).click();
  await page.getByRole("button",{name:"Yordam diagnostikasini ko‘rish"}).click();
  const supportDetail=page.getByRole("dialog",{name:"Sinov biznesi — juda uzun kompaniya nomi"});
  await expect(supportDetail.getByRole("tab",{name:"Diagnostika"})).toHaveAttribute("aria-selected","true");
  await expect(supportDetail.getByRole("heading",{name:"Yordam diagnostikasi"})).toBeVisible();
  await supportDetail.getByRole("button",{name:"Yopish"}).click();
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
