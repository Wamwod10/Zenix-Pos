import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("Billing direct URL is protected by module permission",()=>{
  const app=read("src/App.jsx");
  assert.match(app,/path="billing" element={<PermissionAccess permission="moduleBilling"><Billing\/><\/PermissionAccess>}/);
});

test("branch-locked accounts never fall back to another active store",()=>{
  const store=read("src/context/StoreContext.jsx");
  assert.match(store,/const branchAssignmentValid=!branchLockedRole\|\|Boolean\(assignedStore\)/);
  assert.match(store,/branchLockedRole\s*\? \(currentUser\?\.storeId \|\| DEFAULT_STORE_ID\)/);
  assert.doesNotMatch(store,/branchLockedRole\s*\?\s*\(assignedStore\?\.id \|\| activeStores\[0\]\?\.id/);
});

test("workspace persistence is server-authoritative and surfaces API failures",()=>{
  const store=read("src/context/StoreContext.jsx");
  const apiClient=read("src/services/apiClient.js");
  assert.match(store,/api\.get\("\/api\/bootstrap"\)/);
  assert.match(store,/setPersistenceError\(message\);if\(!silent\)\{setWorkspaceLoadError\(message\);setWorkspaceLoading\(false\);\}/);
  assert.match(store,/const apiFailure=/);
  assert.match(apiClient,/credentials:"include"/);
  assert.doesNotMatch(store,/localStorage|sessionStorage|indexedDB/i);
});

test("branch lifecycle guards are enforced by backend dependencies and store limit",()=>{
  const stores=read("../backend/src/routes/stores.js");
  assert.match(stores,/requirePermission\("settingsWrite"\)/);
  assert.match(stores,/store_limit/);
  assert.match(stores,/STORE_LIMIT/);
  assert.match(stores,/shifts/);
  assert.match(stores,/inventory_balances/);
  assert.match(stores,/stock_transfers/);
  assert.match(stores,/inventory_counts/);
  assert.match(stores,/STORE_HAS_DEPENDENCIES/);
});

test("sales, shifts and analytics persist stable account identities",()=>{
  const sales=read("src/pages/sales/Sales.jsx");
  const shifts=read("src/pages/shifts/Shifts.jsx");
  const history=read("src/pages/history/History.jsx");
  const analytics=read("src/pages/analytics/Analytics.jsx");
  assert.match(sales,/sellerId:currentUser\?\.employeeId\|\|currentUser\?\.id/);
  assert.match(sales,/sellerAccountId:currentUser\?\.id/);
  assert.match(shifts,/cashierId:currentUser\?\.employeeId\|\|currentUser\?\.id/);
  assert.match(shifts,/cashierAccountId:currentUser\?\.id/);
  assert.match(history,/sellerKey/);
  assert.match(analytics,/sellerIdentity/);
});

test("returns are server-authoritative and cannot cross branches",()=>{
  const store=read("src/context/StoreContext.jsx");
  const backend=read("../backend/src/routes/sales.js");
  for(const file of ["src/pages/sales/Sales.jsx","src/pages/history/History.jsx"]){
    const source=read(file);
    assert.match(source,/returnStoreId/);
    assert.match(source,/String\(returnStoreId\)!==String\(currentStoreId\)/);
    assert.match(source,/await commitReturnTransaction/);
  }
  assert.match(store,/\/returns`/);
  assert.match(backend,/assertStoreScope\(req\.user,sale\.store_id\)/);
  assert.match(backend,/sale\.store_id/);
});

test("serialized receiving validates quantity and global duplicate serials on the backend",()=>{
  const inventory=read("../backend/src/routes/inventory.js");
  assert.match(inventory,/serials\.length!==Number\(line\.quantity\)/);
  assert.match(inventory,/DUPLICATE_SERIAL/);
  assert.match(inventory,/SERIAL_QUANTITY_MISMATCH/);
  assert.match(inventory,/product_serials/);
  assert.match(inventory,/SERIAL_EXISTS/);
});

test("pending transfers reserve stock and receiving records discrepancies on the backend",()=>{
  const inventory=read("../backend/src/routes/inventory.js");
  assert.match(inventory,/status IN\('pending','approved'\)/);
  assert.match(inventory,/INSUFFICIENT_AVAILABLE_STOCK/);
  assert.match(inventory,/received_with_difference/);
  assert.match(inventory,/DIFFERENCE_REASON_REQUIRED/);
  assert.match(inventory,/sentQuantity/);
  assert.match(inventory,/receivedQuantity/);
});

test("stocked products and indebted suppliers cannot be archived",()=>{
  const products=read("../backend/src/routes/products.js");
  const suppliers=read("../backend/src/routes/suppliers.js");
  assert.match(products,/inventory_balances/);
  assert.match(products,/PRODUCT_HAS_STOCK|qoldiq/i);
  assert.match(suppliers,/SUPPLIER_HAS_DEBT/);
  assert.match(suppliers,/Qarzi mavjud/);
});

test("user accounts are PostgreSQL-backed and never truncated in browser storage",()=>{
  const auth=read("src/context/AuthContext.jsx");
  const users=read("../backend/src/routes/users.js");
  assert.match(auth,/api\.get\("\/api\/users"\)/);
  assert.match(auth,/api\.post\("\/api\/users"/);
  assert.match(users,/INSERT INTO users/);
  assert.doesNotMatch(auth,/localStorage|sessionStorage|slice\(0,\s*50\)/i);
});

test("audit history cannot be forged through a generic client activity endpoint",()=>{
  const app=read("../backend/src/app.js");
  const store=read("src/context/StoreContext.jsx");
  assert.doesNotMatch(app,/\/api\/activity/);
  assert.doesNotMatch(store,/api\.post\(["']\/api\/activity/);
  assert.match(store,/authoritative[\s\S]*audit trail[\s\S]*backend/i);
});

test("cashier expense visibility prefers stable employee ids over display names",()=>{
  const expenses=read("src/pages/expenses/Expenses.jsx");
  assert.match(expenses,/e\.employeeId[\s\S]*currentUser\?\.id/);
  assert.match(expenses,/!e\.employeeId&&e\.employee===currentUser\?\.name/);
});

test("Products uses the server last-sale aggregate instead of requiring full sales history",()=>{
  const products=read("src/pages/products/Products.jsx");
  assert.match(products,/product\?\.lastSaleAt/);
  assert.doesNotMatch(products,/const catalogSales=/);
});
