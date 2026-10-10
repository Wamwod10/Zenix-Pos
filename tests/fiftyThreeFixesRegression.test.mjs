import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('customer KPI cards have labels and icons',()=>{const s=read('src/pages/customers/Customers.jsx');assert.match(s,/label="Jami mijozlar"/);assert.match(s,/icon=\{FiUser\}/)});
test('POS supports customer selection and quick create for every payment type',()=>{const s=read('src/pages/sales/Sales.jsx');assert.match(s,/Yangi mijoz/);assert.match(s,/quickCustomer/);assert.match(s,/customerId:customerId||null,creditAmount/)});
test('POS customer chooser follows focus, closes after selection and stays readable in light theme',()=>{const page=read('src/pages/sales/Sales.jsx');const css=read('src/pages/sales/sales.scss');assert.match(page,/customerPickerOpen/);assert.match(page,/if\(!customerPickerOpen\)/);assert.match(page,/setCustomerPickerOpen\(false\)/);assert.match(page,/onFocus=\{\(\)=>setCustomerPickerOpen\(true\)\}/);assert.match(page,/event\.key==="Escape"/);assert.match(page,/customerPickerOpen&&!customerId&&\(customerOptions\.length>0\|\|customer\.trim\(\)\)/);assert.match(css,/\.pos-customer-results\{[^}]*background:var\(--card-bg\)[^}]*color:var\(--text\)/)});
test('customer profile supports editing without covering the edit form',()=>{const s=read('src/pages/customers/Customers.jsx');assert.match(s,/Mijozni tahrirlash/);assert.match(s,/api\.patch\(`\/api\/customers/);assert.match(s,/<Modal open=\{!!detail&&!editOpen\}/)});
test('product permanent delete is exposed through store context and product UI',()=>{assert.match(read('src/context/StoreContext.jsx'),/deleteProduct/);assert.match(read('src/pages/products/Products.jsx'),/Butunlay o‘chirish/)});
test('technical shift ids are not rendered in expenses',()=>{const s=read('src/pages/expenses/Expenses.jsx');assert.doesNotMatch(s,/>\{e\.shiftId\|\|/);assert.doesNotMatch(s,/value=\{form\.shiftId\|\|activeShift\?\.id/)});
test('historical expense shifts are not labelled as the current open shift',()=>{const s=read('src/pages/expenses/Expenses.jsx');assert.match(s,/Avvalgi smenaga bog‘langan/);assert.doesNotMatch(s,/\(form\.shiftId\|\|activeShift\?\.id\)\?"Joriy ochiq smena"/)});
test('transfer confirmation uses human document label not UUID',()=>{const s=read('src/pages/inventory/Inventory.jsx');assert.doesNotMatch(s,/message:`\$\{transfer\.id\}/);assert.match(s,/transferDisplayLabel/)});
test('platform admin does not render organization UUID as primary metadata',()=>{const s=read('src/pages/platformAdmin/PlatformAdmin.jsx');assert.doesNotMatch(s,/<small>\{org\.id\}<\/small>/)});
test('branch creation awaits server result before showing failure or closing modal',()=>{const s=read('src/layout/MainLayout.jsx');assert.match(s,/const submitBranch=async\(\)=>/);assert.match(s,/await addStore\(\{name:branchName\}\)/)});

test('tracked inventory is explained before transfer/count submission', () => {
  const inventory = read('src/pages/inventory/Inventory.jsx');
  assert.match(inventory, /FEFO\/FIFO bo‘yicha avtomatik ajratiladi/);
  assert.match(inventory, /Partiyalar bo‘yicha sanash kerak/);
  assert.match(inventory, /stockBatches/);
  assert.match(inventory, /serializedUnits/);
});

test('permanent product deletion requires typing the exact product name', () => {
  const feedback = read('src/context/FeedbackContext.jsx');
  const dialog = read('src/components/ConfirmDialog.jsx');
  const products = read('src/pages/products/Products.jsx');
  assert.match(feedback, /requireText:\s*options\.requireText/);
  assert.match(dialog, /confirmationText/);
  assert.match(dialog, /confirmValue\s*===\s*confirmationText/);
  assert.match(products, /requireText:\s*product\.name/);
});

test('inventory review notifications and transfer errors never expose raw ids',()=>{
  const inventory=read('src/pages/inventory/Inventory.jsx');
  const api=read('src/services/apiClient.js');
  assert.doesNotMatch(inventory,/message:count\.id/);
  assert.match(api,/PRODUCT_HAS_TRANSFER/);
  assert.match(api,/INVENTORY_COUNT_CONFLICT/);
});


test('audit formatter never emits raw JSON syntax for nested business changes', async()=>{
  const {formatAuditValue}=await import('../src/utils/auditChanges.js');
  const value=formatAuditValue({status:'open',meta:{amount:12000},items:[{name:'Grechka',qty:2}]});
  assert.doesNotMatch(value,/[{}\[\]"]/);
  assert.match(value,/Holat: Ochiq/);
  assert.match(value,/Summa: 12/);
  assert.match(value,/Grechka/);
});

test('platform payment labels never fall back to raw database ids',()=>{
  const s=read('src/pages/platformAdmin/PlatformAdmin.jsx');
  assert.doesNotMatch(s,/payment\.orderId\|\|payment\.id/);
  assert.doesNotMatch(s,/receipt\?\.orderId\|\|receipt\?\.id/);
  assert.match(s,/paymentDisplayLabel/);
});

test('billing history never presents database id as the order number',()=>{
  const s=read('src/pages/billing/Billing.jsx');
  assert.doesNotMatch(s,/item\.orderId\|\|item\.id/);
  assert.doesNotMatch(s,/receiptView\?\.orderId\|\|receiptView\?\.id/);
  assert.match(s,/billingPaymentLabel/);
});

test('unknown backend errors never surface raw server messages to normal users', () => {
  const api = read('src/services/apiClient.js');
  assert.match(api, /const friendlyError=\(error,status\)=>FRIENDLY_ERRORS\[error\?\.code\]\|\|friendlyStatusMessage\(status\)/);
  assert.doesNotMatch(api, /FRIENDLY_ERRORS\[error\?\.code\]\|\|error\?\.message/);
});

test('known authentication and inventory business errors remain actionable',()=>{const api=read('src/services/apiClient.js');assert.match(api,/INVALID_CREDENTIALS:"Kirish nomi yoki parol noto‘g‘ri\./);assert.match(api,/CREDIT_LIMIT_EXCEEDED:/);assert.match(api,/TRACKED_SERIAL_ADJUSTMENT_REQUIRED:/);assert.match(api,/TRACKED_BATCH_ADJUSTMENT_REQUIRED:/)});

test('customer detail uses bounded collections and labels partial histories',()=>{const page=read('src/pages/customers/Customers.jsx');const route=read('../backend/src/routes/customers.js');assert.match(page,/detail\?\.openCredits/);assert.match(page,/historyControls\("sales"\)/);assert.match(route,/openCreditsHasMore/);assert.match(route,/openCredits:/)});
