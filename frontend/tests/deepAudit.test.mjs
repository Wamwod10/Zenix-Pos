import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSessionUser, ROLES } from '../src/config/roles.js';
import { workspaceAccessState } from '../src/utils/license.js';
import { BILLING_CONFIG, addBillingDays, addBillingMonths, billingDaysBetween, prorateExtraStore } from '../src/config/billing.js';
import { paymentService } from '../src/services/paymentService.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('legacy auth sessions normalize to SaaS roles',()=>{
  assert.equal(normalizeSessionUser({role:'admin'}).appRole,ROLES.ADMIN);
  assert.equal(normalizeSessionUser({role:'cashier'}).appRole,ROLES.CASHIER);
  assert.equal(normalizeSessionUser({appRole:'OWNER',role:'admin'}).appRole,ROLES.OWNER);
});

test('license gate opens only verified active access',()=>{
  const now=Date.now();
  assert.equal(workspaceAccessState({organization:{licenseStatus:'ACTIVE'},now}).allowed,true);
  assert.equal(workspaceAccessState({organization:{licenseStatus:'ACTIVE',expiryDate:new Date(now-1000).toISOString()},now}).allowed,false);
  assert.equal(workspaceAccessState({organization:{licenseStatus:'PAYMENT_REQUIRED'},now}).allowed,false);
  assert.equal(workspaceAccessState({organization:{licenseStatus:'REJECTED'},now}).allowed,false);
  assert.equal(workspaceAccessState({organization:{licenseStatus:'REVIEW'},payments:[{status:'REVIEW',type:'LICENSE'}],now}).allowed,false);
});

test('billing matches approved September pricing',()=>{
  assert.equal(BILLING_CONFIG.monthly.amount,350000);
  assert.equal(BILLING_CONFIG.annual.amount,3300000);
  assert.equal(BILLING_CONFIG.annual.saving,900000);
  assert.equal(BILLING_CONFIG.extraStore.annualAmount,1100000);
  assert.equal(BILLING_CONFIG.extraStore.monthlyAmount,120000);
  assert.equal(prorateExtraStore(365),1100000);
});

test('billing renewal uses an exact target date and prices the selected period',()=>{
  assert.equal(addBillingDays('2026-09-10',1),'2026-09-11');
  assert.equal(addBillingMonths('2026-01-31',1),'2026-02-28');
  assert.equal(billingDaysBetween('2026-09-10','2027-09-10'),365);
  const order=paymentService.buildRenewalOrder({
    plan:'ANNUAL',currentExpiry:'2026-09-10',targetExpiry:'2027-09-10',renewalExtraStores:1,
  });
  assert.equal(order.extensionDays,365);
  assert.equal(order.baseAmount,3300000);
  assert.equal(order.extraStoreAmount,1100000);
  assert.equal(order.amount,4400000);
  assert.equal(order.servicePeriodFrom,'2026-09-10');
  assert.equal(order.servicePeriodTo,'2027-09-10');
  assert.equal(order.targetExpiry,'2027-09-10');
});

test('Billing protects active stores and prices extra slots for the full remaining period',()=>{
  const billingPage=read('src/pages/billing/Billing.jsx');
  assert.match(billingPage,/const remainingDays=expiry\?Math\.max\(1,daysUntil\(expiry\)\):currentPlanDays/);
  assert.match(billingPage,/minimumRenewExtraStores=Math\.max\(0,used-included\)/);
  assert.match(billingPage,/Math\.max\(minimumRenewExtraStores,value-1\)/);
  const twoYearExtra=paymentService.buildOrder({
    type:'EXTRA',plan:'ANNUAL',remainingDays:730,extraStores:1,currentExpiry:'2026-09-24',targetExpiry:'2028-09-23',
  });
  assert.equal(twoYearExtra.amount,2200000);
  assert.equal(twoYearExtra.servicePeriodFrom,'2026-09-24');
  assert.equal(twoYearExtra.servicePeriodTo,'2028-09-23');
});

test('Billing exposes target-date renewal instead of reusing plan cards',()=>{
  const billingPage=read('src/pages/billing/Billing.jsx');
  const store=read('src/context/StoreContext.jsx');
  const backend=read('../backend/src/routes/billing.js');
  assert.match(billingPage,/Qachongacha uzaytirish/);
  assert.match(billingPage,/\+1 oy/);
  assert.match(billingPage,/\+3 oy/);
  assert.match(billingPage,/\+6 oy/);
  assert.match(billingPage,/\+12 oy/);
  assert.match(billingPage,/renewExtraStores/);
  assert.match(billingPage,/createBillingDraft/);
  assert.match(store,/const createBillingDraft = useCallback/);
  assert.match(store,/const loadBillingDraft = useCallback/);
  assert.match(backend,/billing_drafts/);
  assert.match(backend,/total_amount/);
});

test('approved v4 neutral charcoal design remains the visual authority',()=>{
  const layout=read('src/layout/mainlayout.scss');
  const shell=read('src/layout/MainLayout.jsx');
  const dashboard=read('src/pages/dashboard/Dashboard.jsx');
  assert.match(layout,/body\.dark-mode\{\s*--bg:#111315;--card-bg:#181a1d;/);
  assert.match(layout,/body\.dark-mode \.header\{background:rgba\(17,19,21,\.84\)\}/);
  assert.match(layout,/--sidebar-width:277px/);
  assert.match(layout,/--header-height:82px/);
  assert.match(shell,/<strong>ZENIX POS<\/strong><small>SAVDO TIZIMI<\/small>/);
  assert.match(dashboard,/dashboard-kpis/);
  assert.match(dashboard,/Savdo dinamikasi/);
});

test('global design system exposes professional typography tokens',()=>{
  const base=read('src/index.css');
  const layout=read('src/layout/mainlayout.scss');
  const shared=read('src/styles/saas.scss');
  assert.match(base,/--font-family:/);
  assert.match(base,/Inter/);
  assert.doesNotMatch(base,/font-family:\s*Arial/i);
  assert.match(layout,/--text-primary:/);
  assert.match(layout,/--surface-secondary:/);
  assert.match(shared,/font-size:\s*var\(--font-size-body\)/);
  assert.match(shared,/font-weight:\s*var\(--font-weight-semibold\)/);
});

test('every lazy route resolves and Help Center is wired into navigation',()=>{
  const app=read('src/App.jsx');
  const layout=read('src/layout/MainLayout.jsx');
  const imports=[...app.matchAll(/lazy\(\(\)=>import\("([^\"]+)"\)\)/g)].map(m=>m[1]);
  assert.ok(imports.length>=16);
  for(const rel of imports){
    const base=path.resolve(root,'src',rel.replace(/^\.\//,''));
    const candidates=[`${base}.jsx`,`${base}.js`,path.join(base,'index.jsx')];
    assert.ok(candidates.some(fs.existsSync),`missing lazy route ${rel}`);
  }
  assert.match(app,/path="help"/);
  assert.match(layout,/Yordam Markazi/);
});

test('active sessions are server-authoritative with expiry and throttled heartbeat',()=>{
  const auth=read('src/context/AuthContext.jsx');
  const middleware=read('../backend/src/middleware/auth.js');
  const users=read('../backend/src/routes/users.js');
  assert.match(auth,/api\.get\("\/api\/auth\/me"\)/);
  assert.match(auth,/api\.get\("\/api\/users\/me\/sessions"\)/);
  assert.match(middleware,/s\.expires_at>now\(\)/);
  assert.match(middleware,/last_seen_at/);
  assert.match(middleware,/Date\.now\(\)-lastSeenAt>60_000/);
  assert.match(users,/auth_sessions/);
  assert.match(users,/revoked_at=now\(\)/);
});

test('new employees validate Uzbek phones and PostgreSQL enforces active-phone uniqueness',()=>{
  const settings=read('src/pages/settings/Settings.jsx');
  const auth=read('src/context/AuthContext.jsx');
  const migration=read('../backend/migrations/001_initial.sql');
  assert.match(settings,/Telefon raqami \*/);
  assert.match(settings,/isValidUzPhone/);
  assert.match(settings,/sameUzPhone/);
  assert.match(auth,/api\.post\("\/api\/users"/);
  assert.match(migration,/users_org_phone_unique/);
  assert.match(migration,/regexp_replace\(phone/);
});

test('employee accounts use server-side forced-password and permission overrides',()=>{
  const auth=read('src/context/AuthContext.jsx');
  const app=read('src/App.jsx');
  const settings=read('src/pages/settings/Settings.jsx');
  const users=read('../backend/src/routes/users.js');
  assert.match(auth,/forcePasswordChange/);
  assert.match(auth,/changeCurrentPassword/);
  assert.match(auth,/upsertEmployeeAccount/);
  assert.match(app,/path="\/change-password"/);
  assert.match(settings,/Shaxsiy ruxsat/);
  assert.match(settings,/Rol sozlamalariga qaytarish/);
  assert.match(users,/permission_overrides/);
  assert.match(users,/must_change_password=true/);
});

test('all feather icon imports are available at runtime',async(t)=>{
  let featherIcons;
  try{featherIcons=await import('react-icons/fi')}catch{t.skip('react-icons dependency is not installed in this audit sandbox');return}
  const files=[];
  const walk=(dir)=>{for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.(js|jsx)$/.test(name))files.push(p)}};
  walk(path.join(root,'src'));
  for(const file of files){
    const source=fs.readFileSync(file,'utf8');
    const imports=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']react-icons\/fi["']/g)];
    for(const match of imports){
      const names=match[1].split(',').map((item)=>item.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      for(const name of names)assert.ok(name in featherIcons,`${path.relative(root,file)} imports missing icon ${name}`);
    }
  }
});

test('source has no live legacy/backend endpoints',()=>{
  const files=[];
  const walk=(dir)=>{for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.(js|jsx|scss|css)$/.test(name))files.push(p)}};
  walk(path.join(root,'src'));
  const combined=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  assert.doesNotMatch(combined,/beryl\.vercel|onrender\.com|localhost:\d+/i);
});

test('modal prefers form fields over the close button',()=>{
  const modal=read('src/components/Modal.jsx');
  assert.match(modal,/data-modal-autofocus/);
  assert.match(modal,/input:not\(\[type="hidden"\]\):not\(\[disabled\]\)/);
  assert.match(modal,/const previous = document\.activeElement/);
});

test('Products is catalog-first and does not import stock or cost',()=>{
  const products=read('src/pages/products/Products.jsx');
  assert.match(products,/Omborga kirim/);
  assert.match(products,/Qoldiq Ombor → Kirim orqali boshqariladi/);
  assert.doesNotMatch(products,/chooseImport|readSpreadsheetFile|importOpen|commitImport/);
  assert.doesNotMatch(products,/numeric\.quantity/);
  assert.doesNotMatch(products,/numeric\.costPrice/);
  assert.doesNotMatch(products,/<th>Tannarx<\/th>/);
  assert.match(products,/Qoldiqdagi pozitsiyalar/);
});

test('Inventory receiving is the primary stock-entry workflow and uses server transactions',()=>{
  const inventory=read('src/pages/inventory/Inventory.jsx');
  const store=read('src/context/StoreContext.jsx');
  const backend=read('../backend/src/routes/inventory.js');
  const defaults=read('src/config/uiDefaults.js');
  assert.match(inventory,/Tovar keldi — shu yerda kirim qiling/);
  assert.match(inventory,/Tezkor kirim/);
  assert.match(inventory,/Qarzga/);
  assert.match(inventory,/commitInventoryReceipt/);
  assert.match(inventory,/commitInventoryTransferCreate/);
  assert.match(inventory,/commitInventoryTransferTransition/);
  assert.match(store,/api\.post\("\/api\/inventory\/receive"/);
  assert.match(store,/api\.post\("\/api\/inventory\/transfers"/);
  assert.match(backend,/withTransaction/);
  assert.match(backend,/stock_transfers/);
  assert.match(inventory,/transferApprove/);
  assert.match(inventory,/transferReceive/);
  assert.match(defaults,/transferCreate:true/);
});

test('POS sale commit is centralized through a server-backed StoreContext action',()=>{
  const store=read('src/context/StoreContext.jsx');
  const sales=read('src/pages/sales/Sales.jsx');
  const backend=read('../backend/src/routes/sales.js');
  assert.match(store,/const commitSaleTransaction = useCallback/);
  assert.match(store,/api\.post\("\/api\/sales"/);
  assert.match(sales,/await commitSaleTransaction\(/);
  assert.match(backend,/withTransaction/);
  assert.match(backend,/inventory_balances/);
  assert.doesNotMatch(sales,/\bsetDailySales\b|\bsetInventory\b/);
});

test('POS keeps cart scroll-safe and supports mixed payments',()=>{
  const sales=read('src/pages/sales/Sales.jsx');
  const css=read('src/pages/sales/sales.scss');
  assert.match(sales,/paymentBreakdown/);
  assert.match(sales,/splitValid/);
  assert.match(css,/\.pos-checkout-scroll\{[^}]*overflow-y:auto/s);
  assert.match(css,/\.checkout-primary\{[^}]*position:sticky/s);
});

test('business-day closing and expense cash movement use StoreContext domain actions',()=>{
  const store=read('src/context/StoreContext.jsx');
  const sales=read('src/pages/sales/Sales.jsx');
  const expenses=read('src/pages/expenses/Expenses.jsx');
  assert.match(store,/const commitBusinessDay = useCallback/);
  assert.match(store,/const commitExpenseTransaction = useCallback/);
  assert.match(sales,/commitBusinessDay\(/);
  assert.match(expenses,/commitExpenseTransaction\(/);
  assert.doesNotMatch(expenses,/const syncShiftCash=/);
});

test('POS and History returns share one server-backed commit path',()=>{
  const store=read('src/context/StoreContext.jsx');
  const sales=read('src/pages/sales/Sales.jsx');
  const history=read('src/pages/history/History.jsx');
  const backend=read('../backend/src/routes/sales.js');
  assert.match(store,/const commitReturnTransaction = useCallback/);
  assert.match(sales,/commitReturnTransaction\(/);
  assert.match(history,/commitReturnTransaction\(/);
  assert.match(store,/api\.post\(`\/api\/sales\/\$\{encodeURIComponent\(saleId\)\}\/returns`/);
  assert.match(backend,/router\.post\("\/:id\/returns"/);
});

test('refund cash adjustment reconciles overridden refund methods',async()=>{
  const { getRefundCashAdjustment }=await import('../src/utils/returns.js');
  const cashSale={paymentMethod:'cash',saleTotal:100000,shiftId:'SH-1'};
  const cardSale={paymentMethod:'card',saleTotal:100000,shiftId:'SH-1'};
  assert.deepEqual(getRefundCashAdjustment(cardSale,100000,'cash','SH-1'),{type:'out',amount:100000});
  assert.deepEqual(getRefundCashAdjustment(cashSale,100000,'card','SH-1'),{type:'in',amount:100000});
  assert.equal(getRefundCashAdjustment(cashSale,100000,'cash','SH-1'),null);
  assert.deepEqual(getRefundCashAdjustment(cardSale,50000,'cash','SH-2'),{type:'out',amount:50000});
});

test('billing review never grants temporary workspace access',()=>{
  const license=read('src/utils/license.js');
  const billing=read('src/config/billing.js');
  assert.doesNotMatch(billing,/reviewAccessHours/);
  assert.match(license,/status === "REVIEW"/);
  assert.match(license,/allowed: false/);
});

test('Telegram UI uses one-time startgroup linking without manual BotFather setup',()=>{
  const settings=read('src/pages/settings/Settings.jsx');
  const telegram=read('src/services/telegramService.js');
  const backend=read('../backend/src/routes/telegram.js');
  assert.match(settings,/@zenixposbot/);
  assert.match(settings,/startTelegramConnect/);
  assert.doesNotMatch(settings,/\/connect/);
  assert.doesNotMatch(settings,/BotFather/);
  assert.match(telegram,/createTelegramConnection/);
  assert.match(telegram,/waitForTelegramConnection/);
  assert.match(backend,/startgroup=/);
  assert.match(backend,/interval '15 minutes'/);
});

test('global command search covers sales, employees and supplier invoices',()=>{
  const layout=read('src/layout/MainLayout.jsx');
  const history=read('src/pages/history/History.jsx');
  const settings=read('src/pages/settings/Settings.jsx');
  assert.match(layout,/type:"Savdo"/);
  assert.match(layout,/type:"Nakladnoy"/);
  assert.match(layout,/type:"Xodim"/);
  assert.match(history,/URLSearchParams\(location\.search\).*search/);
  assert.match(settings,/URLSearchParams\(location\.search\).*tab/);
});

test('notification center keeps read state useful across recurring conditions',()=>{
  const layout=read('src/layout/MainLayout.jsx');
  assert.match(layout,/notificationView/);
  assert.match(layout,/visibleNotifications/);
  assert.match(layout,/activeIds=new Set\(notifications\.map/);
  assert.match(layout,/Barchasini o‘qildi/);
});

test('topbar keeps v4 shell while adding full date, separate shortcuts and live FX',()=>{
  const layout=read('src/layout/MainLayout.jsx');
  assert.match(layout,/shortcutOpen/);
  assert.match(layout,/currency/i);
  assert.match(layout,/FiCalendar/);
  assert.match(layout,/Yordam Markazi/);
  assert.match(layout,/inventoryCounts/);
});

test('receipt settings include real print-copy behavior',()=>{
  const defaults=read('src/config/uiDefaults.js');
  const settings=read('src/pages/settings/Settings.jsx');
  const sales=read('src/pages/sales/Sales.jsx');
  assert.match(defaults,/copies:\s*1/);
  assert.match(settings,/Nusxa soni/);
  assert.match(settings,/receipt\.copies/);
  assert.match(sales,/receiptCopies/);
  assert.match(sales,/receipt-print-stack/);
});

test('System diagnostics avoids browser business-storage claims and exposes integration health context',()=>{
  const tools=read('src/pages/settings/SettingsTools.jsx');
  assert.doesNotMatch(tools,/navigator\.storage\.estimate/);
  assert.doesNotMatch(tools,/localStorage|sessionStorage|IndexedDB/i);
  assert.match(tools,/Tizim diagnostikasi/);
  assert.match(tools,/API|server/i);
  assert.match(tools,/Telegram/);
});

test('Settings hides technical interface controls behind advanced disclosure',()=>{
  const settings=read('src/pages/settings/Settings.jsx');
  assert.match(settings,/advancedUi/);
  assert.match(settings,/Kengaytirilgan sozlamalar/);
  assert.match(settings,/Yon menyu kengligi/);
});

test('mobile app shell stays touch-safe and PWA-ready',()=>{
  const layout=read('src/layout/MainLayout.jsx');
  const layoutCss=read('src/layout/mainlayout.scss');
  const sales=read('src/pages/sales/Sales.jsx');
  const salesCss=read('src/pages/sales/sales.scss');
  const settings=read('src/pages/settings/Settings.jsx');
  const settingsCss=read('src/styles/saas.scss');
  const html=read('index.html');
  const manifest=read('public/manifest.webmanifest');
  const serviceWorker=read('public/sw.js');
  const main=read('src/main.jsx');
  assert.match(layout,/mobile-bottom-nav/);
  assert.match(layout,/mobile-header-context/);
  assert.match(layoutCss,/100dvh/);
  assert.match(layoutCss,/env\(safe-area-inset-bottom\)/);
  assert.match(layoutCss,/\.mobile-bottom-nav a,\.mobile-bottom-nav button\{[^}]*min-height:48px/s);
  assert.match(layout,/mobile-offline-banner/);
  assert.match(layoutCss,/mobile-offline-banner/);
  assert.match(sales,/pos-mobile-pane-tabs/);
  assert.match(sales,/setMobilePane\("catalog"\)/);
  assert.match(salesCss,/\.qty-control button[^}]*min-height:44px/s);
  assert.match(settings,/mobileSectionOpen/);
  assert.match(settingsCss,/Mobile Settings — category list first/);
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/manifest\.webmanifest/);
  assert.match(manifest,/"display": "standalone"/);
  assert.match(serviceWorker,/CACHE_NAME/);
  assert.match(main,/serviceWorker\.register\("\/sw\.js",\{updateViaCache:"none"\}\)/);
});

test('DOCX XML text extraction keeps visible paragraphs for conservative import parsing',async()=>{
  const { extractDocxTextFromXml, parseLooseDocumentText }=await import('../src/services/documentImportService.js');
  const text=extractDocxTextFromXml('<w:document><w:body><w:p><w:r><w:t>Ta’minotchi: ABC Distribution</w:t></w:r></w:p><w:p><w:r><w:t>Cola 1L 24 dona 8500</w:t></w:r></w:p></w:body></w:document>');
  assert.match(text,/ABC Distribution/);
  assert.match(text,/Cola 1L/);
  const parsed=parseLooseDocumentText(text);
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].qty,'24');
});

test('text PDF extraction reads simple uncompressed Tj content without inventing stock',async()=>{
  const { extractPdfTextFromArrayBuffer, parseLooseDocumentText }=await import('../src/services/documentImportService.js');
  const pdf='%PDF-1.4\n1 0 obj\n<< /Length 74 >>\nstream\nBT (Ta\\047minotchi: ABC) Tj ET\nBT (Cola 1L 12 dona 8500) Tj ET\nendstream\nendobj\n%%EOF';
  const bytes=new TextEncoder().encode(pdf);
  const text=await extractPdfTextFromArrayBuffer(bytes.buffer);
  assert.match(text,/Cola 1L/);
  const parsed=parseLooseDocumentText(text);
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].qty,'12');
});

test('selected accent remains interaction-only and propagates to key controls',()=>{
  const saas=read('src/styles/saas.scss');
  const layout=read('src/layout/mainlayout.scss');
  assert.match(layout,/--accent-soft:/);
  assert.match(layout,/--accent-border:/);
  assert.match(saas,/\.pro-tabs button\.active[^}]*var\(--accent-soft\)[^}]*var\(--primary\)/s);
  assert.match(saas,/\.settings-nav button\.active[^}]*var\(--accent-soft\)[^}]*var\(--primary\)/s);
  assert.match(saas,/\.pro-search:focus-within[^}]*var\(--accent-border\)[^}]*var\(--accent-focus\)/s);
  assert.match(saas,/\.pro-stat-icon\.blue[^}]*var\(--accent-soft\)[^}]*var\(--primary\)/s);
});

test("supplier invoice ledger overrides stale legacy debt when invoices exist", async () => {
  const { supplierOpenDebt } = await import("../src/utils/supplierLedger.js");
  assert.equal(supplierOpenDebt({ debt: 999999, purchaseHistory: [{ total: 100000, paidAmount: 40000, paymentStatus: "partial" }] }), 60000);
  assert.equal(supplierOpenDebt({ debt: 75000, purchaseHistory: [] }), 75000);
});


test("landscape phone keeps the mobile app shell and POS dynamic viewport", async () => {
  const fs = await import("node:fs/promises");
  const layout = await fs.readFile(new URL("../src/layout/mainlayout.scss", import.meta.url), "utf8");
  const sales = await fs.readFile(new URL("../src/pages/sales/sales.scss", import.meta.url), "utf8");
  assert.match(layout, /max-width:900px\) and \(max-height:600px/);
  assert.match(sales, /max-width:900px\) and \(max-height:600px/);
  assert.doesNotMatch(sales, /calc\(100vh -/);
});

test('approval permissions are configurable and safe by default',()=>{
  const defaults=read('src/config/uiDefaults.js');
  const settings=read('src/pages/settings/Settings.jsx');
  const inventory=read('src/pages/inventory/Inventory.jsx');
  assert.match(settings,/\["inventoryCountApprove","Inventarizatsiyani tasdiqlash"\]/);
  assert.match(settings,/\["closeBusinessDay","Savdo kunini yopish"\]/);
  assert.match(defaults,/MANAGER:\s*\{[\s\S]*?transferApprove:false[\s\S]*?inventoryCountApprove:false[\s\S]*?closeBusinessDay:false/);
  assert.match(inventory,/const canApproveCount=hasPermission\("inventoryCountApprove",currentUser\?\.appRole\)/);
  assert.match(inventory,/const canApproveTransfer=hasPermission\("transferApprove",currentUser\?\.appRole\)/);
  assert.doesNotMatch(inventory,/\[ROLES\.OWNER,ROLES\.ADMIN\]\.includes\(currentUser\?\.appRole\)/);
});

test('topbar approval notices and Settings shortcut follow permissions rather than hard-coded roles',()=>{
  const layout=read('src/layout/MainLayout.jsx');
  assert.match(layout,/canApproveInventoryCount=!isPlatform&&hasPermission\("inventoryCountApprove",currentUser\?\.appRole\)/);
  assert.match(layout,/canApproveTransfer=!isPlatform&&hasPermission\("transferApprove",currentUser\?\.appRole\)/);
  assert.match(layout,/canOpenSettings=!isPlatform&&hasPermission\("moduleSettings",currentUser\?\.appRole\)/);
  assert.match(layout,/notify\.approvals!==false&&\(canApproveInventoryCount\|\|canApproveTransfer\)/);
  assert.match(layout,/\{canOpenSettings&&<button onClick=\{\(\)=>go\("\/settings"\)\}/);
});

test('sale history receipt reprint respects receipt width, copies and workspace branding',()=>{
  const history=read('src/pages/history/History.jsx');
  const css=read('src/pages/history/history.scss');
  assert.match(history,/const receiptCopies=Math\.max\(1,Math\.min\(3,Number\(workspaceSettings\.receipt\?\.copies\|\|1\)\)\)/);
  assert.match(history,/Array\.from\(\{length:receiptCopies\}/);
  assert.match(history,/workspaceSettings\.organization\.businessName/);
  assert.match(history,/workspaceSettings\.receipt\.showPaymentBreakdown/);
  assert.match(history,/workspaceSettings\.receipt\.showCashier/);
  assert.match(css,/\.pro-modal-footer/);
  assert.doesNotMatch(css,/\.pro-modal-foot,/);
});

test('Export Center has an explicit data-export permission',()=>{
  const defaults=read('src/config/uiDefaults.js');
  const settings=read('src/pages/settings/Settings.jsx');
  const tools=read('src/pages/settings/SettingsTools.jsx');
  assert.match(defaults,/OWNER:\s*\{[\s\S]*?dataExport:true/);
  assert.match(defaults,/ADMIN:\s*\{[\s\S]*?dataExport:true/);
  assert.match(defaults,/MANAGER:\s*\{[\s\S]*?dataExport:false/);
  assert.match(settings,/\["dataExport","Ma’lumot eksport qilish"\]/);
  assert.match(tools,/hasPermission\("dataExport",currentUser\?\.appRole\)/);
  assert.match(tools,/disabled=\{!canExport\}/);
});

test('transaction and import identifiers avoid timestamp/random collisions',()=>{
  const store=read('src/context/StoreContext.jsx');
  const documentImport=read('src/services/documentImportService.js');
  assert.doesNotMatch(store,/emp-\$\{Date\.now\(\)\}/);
  assert.doesNotMatch(documentImport,/Math\.random\(\)/);
  assert.match(documentImport,/crypto\.randomUUID\(\)/);
});

test('inventory and expense display dates follow workspace formatting',()=>{
  const inventory=read('src/pages/inventory/Inventory.jsx');
  const store=read('src/context/StoreContext.jsx');
  const expenses=read('src/pages/expenses/Expenses.jsx');
  assert.match(store,/commitInventoryReceipt/);
  assert.match(store,/formatWorkspaceDate\(now,workspaceSettings\.organization/);
  assert.match(expenses,/formatWorkspaceDate\(new Date\(`/);
  assert.doesNotMatch(inventory,/new Date\(\)\.toLocaleDateString\("uz-UZ"\)/);
});

test('shift open, cash movement and close use StoreContext domain actions',()=>{
  const store=read('src/context/StoreContext.jsx');
  const shifts=read('src/pages/shifts/Shifts.jsx');
  assert.match(store,/const commitShiftOpen = useCallback/);
  assert.match(store,/const commitShiftMovement = useCallback/);
  assert.match(store,/const commitShiftClose = useCallback/);
  assert.match(shifts,/commitShiftOpen\(\{shift/);
  assert.match(shifts,/commitShiftMovement\(\{movement/);
  assert.match(shifts,/commitShiftClose\(\{closedShift/);
  assert.doesNotMatch(shifts,/setShiftHistory\(/);
});

test('Settings write access follows explicit permission instead of hard-coded roles',()=>{
  const defaults=read('src/config/uiDefaults.js');
  const settings=read('src/pages/settings/Settings.jsx');
  assert.match(defaults,/settingsWrite:true/);
  assert.match(defaults,/settingsWrite:false/);
  assert.match(settings,/hasPermission\("settingsWrite",currentUser\?\.appRole\)/);
  assert.doesNotMatch(settings,/const canWrite=\[ROLES\.OWNER,ROLES\.ADMIN\]/);
  assert.match(settings,/\["settingsWrite","Sozlamalarni o‘zgartirish"\]/);
});

test('Billing submission and review use server-backed StoreContext domain actions',()=>{
  const store=read('src/context/StoreContext.jsx');
  const billing=read('src/pages/billing/Billing.jsx');
  const platform=read('src/pages/platformAdmin/PlatformAdmin.jsx');
  assert.match(store,/const commitBillingSubmission = useCallback/);
  assert.match(store,/const commitBillingReview = useCallback/);
  assert.match(store,/api\.upload\("\/api\/billing\/receipts"/);
  assert.match(store,/api\.post\("\/api\/billing\/payments"/);
  assert.match(store,/api\.post\(`\/api\/platform\/payments/);
  assert.match(billing,/commitBillingSubmission/);
  assert.match(platform,/commitBillingReview/);
  assert.doesNotMatch(billing,/\bsetPayments\b|\bsetOrganizations\b/);
  assert.doesNotMatch(platform,/\bsetPayments\b|\bsetOrganizations\b/);
});

test('inventory adjustment and count approval are centralized in StoreContext',()=>{
  const store=read('src/context/StoreContext.jsx');
  const inventory=read('src/pages/inventory/Inventory.jsx');
  assert.match(store,/const commitInventoryAdjustment = useCallback/);
  assert.match(store,/const commitInventoryCountSubmit = useCallback/);
  assert.match(store,/const commitInventoryCountReview = useCallback/);
  assert.match(inventory,/commitInventoryAdjustment/);
  assert.match(inventory,/commitInventoryCountSubmit/);
  assert.match(inventory,/commitInventoryCountReview/);
});

test('supplier debt payment uses one StoreContext domain action',()=>{
  const store=read('src/context/StoreContext.jsx');
  const suppliers=read('src/pages/suppliers/Suppliers.jsx');
  assert.match(store,/const commitSupplierPayment = useCallback/);
  assert.match(suppliers,/commitSupplierPayment/);
});

test('Products keeps batch expiry and serial tracking inside Inventory receiving',()=>{
  const products=read('src/pages/products/Products.jsx');
  const inventory=read('src/pages/inventory/Inventory.jsx');
  assert.doesNotMatch(products,/<span>Yaroqlilik muddati<\/span>/);
  assert.doesNotMatch(products,/<span>IMEI<\/span>/);
  assert.doesNotMatch(products,/<span>Serial raqam<\/span>/);
  assert.doesNotMatch(products,/"IMEI","Serial"/);
  assert.match(inventory,/Partiya \/ batch raqami/);
  assert.match(inventory,/Serial \/ IMEI/);
});

test('login validation uses the Uzbek web term for username',()=>{
  const login=read('src/pages/login/Login.jsx');
  assert.match(login,/Kirish nomi va parolni kiriting/);
  assert.doesNotMatch(login,/Login va parolni kiriting/);
});

test('Dashboard payment mix uses net split-payment accounting after returns',()=>{
  const dashboard=read('src/pages/dashboard/Dashboard.jsx');
  assert.match(dashboard,/saleNetPaymentBreakdown/);
  assert.doesNotMatch(dashboard,/payment\.cash\+=Number\(s\.paymentBreakdown/);
});

test('Dashboard product ranking and return rate use net quantities with a gross denominator',()=>{
  const dashboard=read('src/pages/dashboard/Dashboard.jsx');
  assert.match(dashboard,/getNetSoldQty\(item\)/);
  assert.match(dashboard,/returnedAmountForSale\(sale\)/);
  assert.match(dashboard,/const grossRevenue=revenue\+returnTotal/);
  assert.match(dashboard,/returnTotal\/grossRevenue\*100/);
});

test('Products last-sale detail uses the server aggregate without exposing full sales history',()=>{
  const products=read('src/pages/products/Products.jsx');
  const bootstrap=read('../backend/src/routes/bootstrap.js');
  assert.match(products,/product\?\.lastSaleAt/);
  assert.doesNotMatch(products,/salesHistory\.flatMap|const catalogSales=/);
  assert.match(bootstrap,/AS last_sale_at/i);
});

test('POS page cannot bypass centralized sale and return state actions',()=>{
  const sales=read('src/pages/sales/Sales.jsx');
  assert.doesNotMatch(sales,/\bsetInventory\b|\bsetDailySales\b|\bsetSalesHistory\b|\bsetReturns\b/);
  assert.match(sales,/commitSaleTransaction/);
  assert.match(sales,/commitReturnTransaction/);
});

test('Platform billing approval requires confirmation and reports the result',()=>{
  const platform=read('src/pages/platformAdmin/PlatformAdmin.jsx');
  assert.match(platform,/To‘lovni tasdiqlaysizmi\?/);
  assert.match(platform,/await confirm\(/);
  assert.match(platform,/To‘lov tasdiqlandi/);
  assert.match(platform,/Amal bajarilmadi/);
});

test('Platform administration tables remember visible columns per tab',()=>{
  const platform=read('src/pages/platformAdmin/PlatformAdmin.jsx');
  assert.match(platform,/zenix_platform_payment_columns/);
  assert.match(platform,/zenix_platform_customer_columns/);
  assert.match(platform,/ColumnPicker/);
  assert.match(platform,/showPaymentColumn\("amount"\)/);
  assert.match(platform,/showCustomerColumn\("expiry"\)/);
});

test('Export Center covers operational inventory, return, shift and employee data',()=>{
  const tools=read('src/pages/settings/SettingsTools.jsx');
  assert.match(tools,/title: "Ombor harakatlari"/);
  assert.match(tools,/title: "Transferlar"/);
  assert.match(tools,/title: "Qaytarishlar"/);
  assert.match(tools,/title: "Smenalar"/);
  assert.match(tools,/title: "Xodimlar"/);
  assert.match(tools,/title: "Tarif to‘lovlari"/);
  assert.match(tools,/exportTabular\("Ombor harakatlari"/);
});


test('catalog, supplier and store mutations are audited by the backend',()=>{
  const products=read('../backend/src/routes/products.js');
  const suppliers=read('../backend/src/routes/suppliers.js');
  const stores=read('../backend/src/routes/stores.js');
  const activity=read('src/pages/activityLog/ActivityLog.jsx');
  assert.match(products,/writeAudit/);
  assert.match(products,/before:/);
  assert.match(products,/after:/);
  assert.match(suppliers,/writeAudit/);
  assert.match(stores,/writeAudit/);
  assert.match(activity,/normalizeActivityChanges/);
  assert.match(activity,/activity-change-list/);
});

test('visible authentication copy consistently uses Kirish nomi',()=>{
  const settings=read('src/pages/settings/Settings.jsx');
  const profile=read('src/pages/profile/Profile.jsx');
  const register=read('src/pages/register/Register.jsx');
  const backendAuth=read('../backend/src/routes/auth.js');
  assert.match(settings,/label:"Kirish nomi"/);
  assert.match(profile,/Kirish nomi va aloqa ma’lumotlari/);
  assert.match(register,/<span>Kirish nomi<\/span>/);
  assert.match(backendAuth,/Kirish nomi yoki parol noto‘g‘ri/);
  assert.doesNotMatch(register,/>Login</);
});
