import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const coordinatorModule=await import("../src/services/requestCoordinator.js").catch(()=>({}));
const refreshModule=await import("../src/utils/workspaceRefresh.js").catch(()=>({}));

const store=fs.readFileSync(new URL("../src/context/StoreContext.jsx",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../../backend/migrations/011_bootstrap_performance_indexes.sql",import.meta.url),"utf8");
const read=(relative)=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),"utf8");

test("inventory hot-path lookups use a memoized map instead of repeated linear scans",()=>{
  assert.match(store,/inventoryById = useMemo\(\(\)=>new Map/);
  assert.match(store,/inventoryById\.get\(String\(productId\)\)/);
});

test("bootstrap history tables have production read-path indexes",()=>{
  for(const index of ["sale_returns_org_store_created_idx","expenses_org_store_created_idx","shifts_org_store_opened_idx","supplier_invoices_org_store_created_idx","supplier_payments_org_store_created_idx","inventory_counts_org_store_created_idx","billing_payments_org_submitted_idx","sale_items_product_sale_idx","sale_payments_sale_idx"]){assert.ok(migration.includes(index),index)}
});

test("API client deduplicates identical in-flight GET requests without caching mutations", () => {
  const api = read("src/services/apiClient.js");
  assert.match(api, /createRequestCoordinator/);
  assert.match(api, /requestCoordinator\.get/);
  assert.match(api, /requestCoordinator\.mutate/);
});

test("POS and Products use indexed maps for frequent product and receive lookups", () => {
  const sales = read("src/pages/sales/Sales.jsx");
  const products = read("src/pages/products/Products.jsx");
  assert.match(sales, /const productById=useMemo\(\(\)=>new Map/);
  assert.match(sales, /const productByBarcode=useMemo/);
  assert.match(sales, /productByBarcode\.get\(code\)/);
  assert.match(products, /const lastReceiveByProduct=useMemo/);
  assert.match(products, /const productById=useMemo\(\(\)=>new Map/);
});

test("bootstrap computes product last-sale timestamps with one aggregate join", () => {
  const bootstrap = fs.readFileSync(new URL("../../backend/src/routes/bootstrap.js",import.meta.url),"utf8");
  assert.match(bootstrap, /SELECT si\.product_id,max\(s\.created_at\) AS last_sale_at/);
  assert.match(bootstrap, /GROUP BY si\.product_id/);
  assert.doesNotMatch(bootstrap, /\(SELECT max\(s\.created_at\) FROM sale_items/);
});

test("a mutation boundary prevents an authenticated GET from being reused by the next session", async () => {
  assert.equal(typeof coordinatorModule.createRequestCoordinator,"function");
  const coordinator=coordinatorModule.createRequestCoordinator();
  let resolveFirst;
  const first=coordinator.get("/api/bootstrap",()=>new Promise((resolve)=>{resolveFirst=resolve}));

  await coordinator.mutate(async()=>({ok:true}));
  const second=coordinator.get("/api/bootstrap",async()=>({tenant:"B"}));
  resolveFirst({tenant:"A"});

  assert.deepEqual(await first,{tenant:"A"});
  assert.deepEqual(await second,{tenant:"B"});
  assert.notEqual(first,second);
});

test("identical GETs deduplicate only inside the same mutation generation", async () => {
  assert.equal(typeof coordinatorModule.createRequestCoordinator,"function");
  const coordinator=coordinatorModule.createRequestCoordinator();
  let starts=0;
  const start=async()=>{starts+=1;return {ok:true}};

  const [first,second]=await Promise.all([
    coordinator.get("/api/settings",start),
    coordinator.get("/api/settings",start),
  ]);

  assert.equal(starts,1);
  assert.deepEqual(first,{ok:true});
  assert.deepEqual(second,{ok:true});
});

test("workspace refresh coalesces bursts without postponing forever", async () => {
  assert.equal(typeof refreshModule.createWorkspaceRefreshScheduler,"function");
  const calls=[];
  let identity="user-a:org-a:OWNER";
  const scheduler=refreshModule.createWorkspaceRefreshScheduler({
    delay:15,
    currentIdentity:()=>identity,
    refresh:(scheduledIdentity)=>calls.push(scheduledIdentity),
  });

  scheduler.schedule(identity);
  scheduler.schedule(identity);
  await new Promise((resolve)=>setTimeout(resolve,35));

  assert.deepEqual(calls,["user-a:org-a:OWNER"]);
});

test("workspace refresh drops work scheduled for a previous account", async () => {
  assert.equal(typeof refreshModule.createWorkspaceRefreshScheduler,"function");
  const calls=[];
  let identity="user-a:org-a:OWNER";
  const scheduler=refreshModule.createWorkspaceRefreshScheduler({
    delay:15,
    currentIdentity:()=>identity,
    refresh:(scheduledIdentity)=>calls.push(scheduledIdentity),
  });

  scheduler.schedule(identity);
  identity="user-b:org-b:OWNER";
  await new Promise((resolve)=>setTimeout(resolve,35));

  assert.deepEqual(calls,[]);
});

test("a cancelled workspace scheduler cannot be re-armed by a late mutation", async () => {
  assert.equal(typeof refreshModule.createWorkspaceRefreshScheduler,"function");
  const calls=[];
  const scheduler=refreshModule.createWorkspaceRefreshScheduler({
    delay:10,
    currentIdentity:()=>"user-b:org-b:OWNER",
    refresh:(scheduledIdentity)=>calls.push(scheduledIdentity),
  });

  scheduler.cancel();
  scheduler.schedule("user-b:org-b:OWNER");
  await new Promise((resolve)=>setTimeout(resolve,25));

  assert.deepEqual(calls,[]);
});

test("workspace refresh is single-flight and performs one dirty follow-up", async () => {
  assert.equal(typeof refreshModule.createWorkspaceRefreshScheduler,"function");
  const resolvers=[];
  let starts=0;
  const scheduler=refreshModule.createWorkspaceRefreshScheduler({
    delay:10,
    currentIdentity:()=>"user-a:org-a:OWNER",
    refresh:()=>new Promise((resolve)=>{starts+=1;resolvers.push(resolve)}),
  });

  scheduler.schedule("user-a:org-a:OWNER");
  await new Promise((resolve)=>setTimeout(resolve,20));
  scheduler.schedule("user-a:org-a:OWNER");
  scheduler.schedule("user-a:org-a:OWNER");
  assert.equal(starts,1);

  await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(starts,1);

  resolvers.shift()();
  await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(starts,2);
  resolvers.shift()();
  await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(starts,2);
});

test("an opened database shift is normalized for immediate UI use", () => {
  assert.equal(typeof refreshModule.normalizeOpenedShift,"function");
  const server={id:"shift-2",store_id:"store-2",cashier_id:"user-2",opening_cash:"125000",opened_at:"2026-09-30T10:00:00.000Z",status:"open"};
  const optimistic={storeId:"store-2",cashierId:"user-2",cashierName:"Ali",storeName:"Markaz",openingCash:125000,openedAtISO:"2026-09-30T10:00:00.000Z",cashMovements:[]};
  const opened=refreshModule.normalizeOpenedShift(server,optimistic);
  assert.deepEqual(opened,{...optimistic,...server,storeId:"store-2",cashierId:"user-2",openingCash:125000,openedAtISO:"2026-09-30T10:00:00.000Z"});
  assert.deepEqual(
    refreshModule.withOpenedShift({"store-1":{id:"shift-1"}},opened,"store-2"),
    {"store-1":{id:"shift-1"},"store-2":opened},
  );
});
