import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {remainingPayment,sumMoney} from '../src/utils/posMoney.js';

// Protect the legacy Sales checkout path against JS binary floating errors.
// Server moneyValue checks exact decimal cents and must remain strict.
test('Sales POS split cash is exactly cent-precise after card/transfer amounts',()=>{
  for(const [total,card,transfer,expected] of [
    [0.30,0.10,0.10,0.10],
    [100.30,0.10,0.10,100.10],
    [127000.30,0.10,0.10,127000.10],
    [20.30,0.10,0.10,20.10],
  ]){
    const cash=remainingPayment(total,[card,transfer]);
    assert.equal(cash,expected);
    assert.equal(sumMoney([cash,card,transfer]),total);
    assert.match(String(cash),/^(?:\\d+)(?:\\.\\d{1,2})?$/);
  }
});

test('Sales POS credit remainder and split change stay exact cents',()=>{
  assert.equal(remainingPayment(0.30,[0.10]),0.20);
  assert.equal(remainingPayment(100.30,[0.10]),100.20);
  assert.equal(remainingPayment(110.30,[100.10]),10.20);
  assert.equal(sumMoney([0.10,0.20]),0.30,'cent-aware validation permits exact tender sum');
});

test('legacy Sales checkout uses cent-aware arithmetic for payload and UI',()=>{
  const source=readFileSync(new URL('../src/pages/sales/Sales.jsx',import.meta.url),'utf8');
  assert.match(source,/remainingPayment\\(total,\\[splitCardN,splitTransferN\\]\\)/);
  assert.match(source,/remainingPayment\\(total,\\[Number\\(creditPaid\\|\\|0\\)\\]\\)/);
  assert.match(source,/remainingPayment\\(splitCashTenderedN,\\[splitCash\\]\\)/);
  assert.match(source,/splitValid=sumMoney\\(\\[splitCardN,splitTransferN\\]\\)<=total/);
});
