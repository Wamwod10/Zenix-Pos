import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { workspaceRouteDecision } from "../src/utils/workspaceReadiness.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sourceFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx|js)$/.test(entry.name)) sourceFiles.push(full);
  }
};
walk(path.join(root, "src"));
const allSource = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

test("Zenix POS UI does not fall back to native select/date controls", () => {
  assert.equal(/<select\b/.test(allSource), false, "Native <select> found; use PremiumSelect.");
  assert.equal(/type=["']date["']/.test(allSource), false, "Native date input found; use PremiumDateInput.");
});

test("document import uses the shared Zenix POS multi-file surface", () => {
  const inventory = read("src/pages/inventory/Inventory.jsx");
  const ui = read("src/components/Ui.jsx");
  assert.match(ui, /export function MultiFilePicker/);
  assert.match(inventory, /<MultiFilePicker/);
  assert.doesNotMatch(inventory, /type=["']file["']/);
});

test("known browser-default and mixed-language UI copy does not regress", () => {
  for (const fragment of [
    "Choose File", "No file chosen", "Cashier-first", "Supplier formatini",
    "permissionlar", "Global yoki joriy filial scope", "autosave holati",
    "frontend connection flow",
    "weighted average",
    "text layer",
    "Scan PDF",
    "Zenix POS localStorage", "POS SYSTEM",
  ]) {
    assert.equal(allSource.includes(fragment), false, `Old UI copy returned: ${fragment}`);
  }
});

test("refresh routing waits for workspace hydration before billing redirect", () => {
  assert.equal(workspaceRouteDecision({workspaceReady:false,organization:null,licenseAllowed:false}),"loading");
  assert.equal(workspaceRouteDecision({workspaceReady:true,organization:null,licenseAllowed:false}),"error");
  assert.equal(workspaceRouteDecision({workspaceReady:true,organization:{id:"org-1"},licenseAllowed:false}),"billing");
});

test("POS quantity is button-only and insufficient cash is explicit", () => {
  const sales = read("src/pages/sales/Sales.jsx");
  assert.match(sales, /className="qty-value"/);
  assert.doesNotMatch(sales, /className="qty-control"[^\n]*<input/);
  assert.match(sales, /"Yetishmaydi"/);
  assert.match(sales, /formatInputMoney\(cashTendered\)/);
});

test("inventory movement history supports saved columns, search and action filtering", () => {
  const inventory = read("src/pages/inventory/Inventory.jsx");
  assert.match(inventory, /movementColumnDefs/);
  assert.match(inventory, /usePersistentColumns\(/);
  assert.match(inventory, /movementSearch/);
  assert.match(inventory, /movementType/);
  assert.match(inventory, /<ColumnPicker columns=\{movementColumnDefs\}/);
  assert.match(inventory, /visibleMovements/);
});

test("responsive styles use dynamic viewport height instead of legacy 100vh", () => {
  const styleFiles = [];
  const walkStyles = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkStyles(full);
      else if (/\.(scss|css)$/.test(entry.name)) styleFiles.push(full);
    }
  };
  walkStyles(path.join(root, "src"));
  const styles = styleFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.equal(styles.includes("100vh"), false, "Legacy 100vh can cut mobile content behind browser chrome; use 100dvh.");
});

test("mobile topbar and compact actions keep touch-safe targets", () => {
  const layout = read("src/layout/mainlayout.scss");
  const ui = read("src/styles/saas.scss");
  assert.match(layout, /\.menu-toggle,\.mobile-search-trigger,\.notification-btn\s*\{[^}]*width:44px;[^}]*height:44px/);
  assert.match(layout, /\.profile-trigger\s*\{[^}]*width:44px;[^}]*height:44px/);
  assert.match(layout, /\.notification-view-tabs button\s*\{[^}]*min-height:44px;[^}]*height:44px/);
  assert.match(layout, /\.tools-menu-head>button,\.guide-coach-head>button\s*\{[^}]*width:44px;[^}]*height:44px/);
  assert.match(ui, /\.premium-select-menu button\s*\{[^}]*min-height:44px/);
  assert.match(ui, /\.premium-date-head button\s*\{[^}]*width:44px;[^}]*height:44px/);
  assert.match(ui, /\.premium-time-column button\s*\{[^}]*height:44px/);
  const products = read("src/pages/products/product.scss");
  const inventory = read("src/pages/inventory/inventory.scss");
  const suppliers = read("src/pages/suppliers/supplier.scss");
  assert.match(products, /\.product-actions-main button,\s*\.product-archive-action\s*\{[^}]*min-height:\s*44px;[^}]*height:\s*44px/);
  assert.match(inventory, /\.inv-actions button,\s*\.transfer-row-pro \.transfer-row-actions button,\s*\.pending-counts button\s*\{[^}]*min-height:44px;[^}]*height:44px/);
  assert.match(suppliers, /\.supplier-actions button\s*\{[^}]*min-height:44px;[^}]*height:44px/);
});

test("Products reuses the shared Zenix POS column picker", () => {
  const products = read("src/pages/products/Products.jsx");
  assert.match(products, /<ColumnPicker columns=\{productColumnDefs\} visible=\{productColumns\}/);
  assert.doesNotMatch(products, /product-columns-trigger/);
});

test("table column preferences use the shared persistence hook", () => {
  const expenses = read("src/pages/expenses/Expenses.jsx");
  const history = read("src/pages/history/History.jsx");
  assert.match(expenses, /usePersistentColumns\("zenix_expense_columns"/);
  assert.match(history, /usePersistentColumns\("zenix_history_columns"/);
  assert.doesNotMatch(expenses, /localStorage\.setItem\("zenix_expense_columns"/);
  assert.doesNotMatch(history, /localStorage\.setItem\("zenix_history_columns"/);
});

test("mobile POS keeps frequent touch actions at app-safe sizes", () => {
  const sales = read("src/pages/sales/sales.scss");
  assert.match(sales, /\.pos-mobile-pane-tabs button\{min-height:44px\}/);
  assert.match(sales, /\.pos-categories button,\.quick-products button\{min-height:44px;height:44px/);
  assert.match(sales, /\.hold-row>button\{min-height:44px;height:44px\}/);
  assert.match(sales, /\.cart-discount-action\{min-height:44px\}/);
});

test("visual polish regressions stay aligned with the approved reference design", () => {
  const ui = read("src/styles/saas.scss");
  const products = read("src/pages/products/product.scss");
  const inventory = read("src/pages/inventory/inventory.scss");
  assert.match(ui, /\.pro-badge,\.saas-badge\s*\{[^}]*min-height:28px!important;[^}]*align-items:center!important;[^}]*justify-content:center!important;[^}]*line-height:1!important/);
  assert.match(products, /\.product-archive-action\s*\{[^}]*width:\s*100%;[^}]*height:\s*40px;[^}]*justify-content:\s*center/);
  assert.match(products, /@media \(max-width: 700px\)[\s\S]*?\.product-actions-main button,[\s\S]*?\.product-archive-action\s*\{[^}]*min-height:\s*44px;[^}]*height:\s*44px/);
  assert.match(products, /@media\(max-width:700px\)[\s\S]*?\.product-archive-action\{border-top:1px solid var\(--border\)!important;border-left:0!important\}/);
  assert.match(inventory, /\.inventory-transfer-layout\{grid-template-columns:minmax\(380px,.9fr\) minmax\(0,1.45fr\)/);
  assert.match(inventory, /@media\(max-width:1120px\)\{[\s\S]*?\.inventory-transfer-layout\{grid-template-columns:1fr\}/);
});


test("Settings employee table supports saved columns and protected bulk actions", () => {
  const settings = read("src/pages/settings/Settings.jsx");
  assert.match(settings, /zenix_settings_employee_columns/);
  assert.match(settings, /ColumnPicker columns=\{employeeColumnDefs\}/);
  assert.match(settings, /bulkEmployeeActive/);
  assert.match(settings, /protectedEmployee/);
  assert.match(settings, /Asosiy egasi va joriy hisob bu amalga kirmaydi/);
});

test("soft premium typography never reintroduces 800/900 UI weights", () => {
  const styleFiles = [];
  const walkStyles = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkStyles(full);
      else if (/\.(scss|css)$/.test(entry.name)) styleFiles.push(full);
    }
  };
  walkStyles(path.join(root, "src"));
  const styles = styleFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.equal(/font-weight\s*:\s*(800|900)\b/.test(styles), false, "Hard 800/900 font weight returned; keep Zenix POS typography soft-premium.");
});


test("advanced table views persist order, width and saved presets", () => {
  const hook = read("src/utils/usePersistentColumns.js");
  const ui = read("src/components/Ui.jsx");
  const expenses = read("src/pages/expenses/Expenses.jsx");
  const history = read("src/pages/history/History.jsx");
  assert.match(hook, /order:/);
  assert.match(hook, /widths:/);
  assert.match(hook, /views:/);
  assert.match(hook, /saveView/);
  assert.match(hook, /applyView/);
  assert.match(ui, /Tartib va kenglik/);
  assert.match(ui, /Saqlangan ko‘rinishlar/);
  assert.match(expenses, /orderedExpenseColumns/);
  assert.match(history, /orderedHistoryColumns/);
});

test("dark-theme contextual panels do not fall back to hard-coded light cards", () => {
  const help = read("src/pages/help/helpCenter.scss");
  const inventory = read("src/pages/inventory/inventory.scss");
  const saas = read("src/styles/saas.scss");
  assert.doesNotMatch(help, /#fffaf0|#f5ead5|#8a6b3f/i);
  assert.match(help, /\.help-tip\{[^}]*background:color-mix\([^}]*var\(--surface\)[^}]*border:1px solid var\(--border\)/);
  assert.doesNotMatch(inventory, /\.pending-counts\{[^}]*#fffaf0/i);
  assert.match(inventory, /\.pending-counts\{[^}]*border:1px solid var\(--border\)[^}]*background:var\(--surface\)/);
  assert.doesNotMatch(saas, /\.billing-renewal-extra\{[^}]*#f8faff/i);
  assert.match(saas, /\.billing-renewal-extra\{[^}]*border:1px solid var\(--border\)[^}]*background:var\(--surface\)[^}]*color:var\(--muted\)/);
});

test("existing ghost actions and inline hints inherit the Zenix design system", () => {
  const ui = read("src/styles/saas.scss");
  const sales = read("src/pages/sales/sales.scss");
  assert.match(ui, /\.pro-btn\.ghost,\.saas-btn\.ghost\{[^}]*background:transparent[^}]*color:var\(--muted\)/);
  assert.match(ui, /\.field-hint\{[^}]*color:var\(--muted\)[^}]*font-size:11\.5px/);
  assert.doesNotMatch(sales, /\.today-sales-list article>button\{[^}]*#fffaf4/);
  assert.match(sales, /\.today-sales-list article>button\{[^}]*background:var\(--surface\)/);
});
