import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sales=fs.readFileSync(new URL('../src/pages/sales/sales.scss',import.meta.url),'utf8');
const inventory=fs.readFileSync(new URL('../src/pages/inventory/inventory.scss',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/components/Ui.jsx',import.meta.url),'utf8');
test('mobile POS product grid is viewport-contained',()=>{assert.match(sales,/grid-template-columns:minmax\(0,1fr\)!important/);assert.match(sales,/\.pos-product\{display:grid!important;width:100%!important;min-width:0!important/)});
test('quick receive becomes a mobile form instead of a 920px table',()=>{assert.match(inventory,/\.quick-receive-row\{min-width:0;width:100%;grid-template-columns:1fr 1fr/);assert.match(inventory,/\.quick-receive-head\{display:none\}/)});
test('premium select menu has a usable minimum width while staying in viewport',()=>{assert.match(ui,/Math\.max\(rect\.width, 180\)/);assert.match(ui,/window\.innerWidth - viewportGap \* 2/)});
