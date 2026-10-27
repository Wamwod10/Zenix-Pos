import test from 'node:test';
import assert from 'node:assert/strict';
import * as reporting from '../src/utils/reporting.js';

test('product ranking nets dated refunds and preserves recorded zero and nonzero costs',()=>{
  assert.equal(typeof reporting.rankProductEvents, 'function');
  const sales=[{id:'s',items:[{productId:'p',name:'Tea',unit:'kg',quantity:2,finalPrice:2000,unitCost:1000},{productId:'q',name:'Free cost',quantity:1,finalPrice:500,unitCost:0}]}];
  const refunds=[{id:'r',saleId:'s',productId:'p',quantity:1,amount:2000,unitCost:1000}];
  const rows=reporting.rankProductEvents(reporting.financialSalesEvents(sales,refunds));
  assert.deepEqual(rows.map(({id,qty,revenue,profit})=>({id,qty,revenue,profit})),[{id:'p',qty:1,revenue:2000,profit:1000},{id:'q',qty:1,revenue:500,profit:500}]);
  const full=reporting.rankProductEvents(reporting.financialSalesEvents(sales,[{...refunds[0],quantity:2,amount:4000}]));
  assert.equal(full.find(x=>x.id==='p').profit,0);
});
import * as dates from '../src/utils/workspaceDate.js';
import * as inventory from '../src/utils/bootstrapInventory.js';

test('transfer confirmation uses response lines and the selected store safely',()=>{
  assert.equal(typeof inventory.transferConfirmation, 'function');
  assert.equal(inventory.transferConfirmation({items:[{},{}],to_store_id:'b'},[{id:'b',name:'Branch B'}]),'2 ta mahsulot · Branch B');
  assert.equal(inventory.transferConfirmation(null,[]),'Transfer yaratildi');
});

test('supplier date-only values preserve calendar day in western time zones',()=>{
  assert.equal(typeof dates.formatWorkspaceCalendarDate,'function');
  const settings={timezone:'America/Los_Angeles',dateFormat:'YYYY-MM-DD'};
  assert.equal(dates.formatWorkspaceCalendarDate('2026-09-30T00:00:00.000Z',settings),'2026-09-30');
  assert.equal(dates.formatWorkspaceCalendarDate('2026-09-30T00:00:00.000Z',{...settings,dateFormat:'DD.MM.YYYY'}),'30.09.2026');
  assert.equal(dates.formatWorkspaceCalendarDate('2026-09-30',{...settings,dateFormat:'MM/DD/YYYY'}),'09/30/2026');
  assert.equal(dates.formatWorkspaceCalendarDate('2026-02-30',settings),'—');
  assert.equal(dates.formatWorkspaceCalendarDate('bad',settings),'—');
  assert.equal(dates.formatWorkspaceCalendarDate(null,settings),'—');
});
test('pending transfer confirmation falls back to submitted lines and selected store',()=>{
  assert.equal(inventory.transferConfirmation({to_store_id:'b'},[{id:'b',name:'Branch B'}],{itemCount:2,toStoreId:'b'}),'2 ta mahsulot · Branch B');
});
