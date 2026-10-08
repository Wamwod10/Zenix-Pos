import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseLooseDocumentText, amountNumber } from '../src/services/documentImportService.js';
import { parseCsvText } from '../src/utils/spreadsheetImport.js';

test('UZS thousands separators never silently lose three zeros',()=>{
  assert.equal(amountNumber('12,000'),12000);
  assert.equal(amountNumber('12.000'),12000);
  assert.equal(amountNumber('1 500,50'),1500.5);
  assert.equal(amountNumber('2,5'),2.5);
});

test('unlabelled table row is parsed by verified multiplication but never called high confidence',()=>{
  const parsed=parseLooseDocumentText('Coca-Cola 1L 24 8500 204000');
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].name,'Coca-Cola 1L');
  assert.equal(parsed.rows[0].qty,'24');
  assert.equal(parsed.rows[0].costPrice,'8500');
  assert.equal(parsed.rows[0].confidence,'review');
});

test('unclear 1L product without quantity is not imported as one unit',()=>{
  assert.equal(parseLooseDocumentText('Coca-Cola 1L 8500').rows.length,0);
});

test('CSV keeps multiline quoted product names in one row',()=>{
  const parsed=parseCsvText('name,qty,cost\n"Coca-\nCola 1L",24,8500\nFanta,12,8300');
  assert.equal(parsed.rows.length,2);
  assert.equal(parsed.rows[0][0].value,'Coca-\nCola 1L');
});

test('imported quick receipt requires manual confirmation and a positive cost',()=>{
  const source=fs.readFileSync('src/pages/inventory/Inventory.jsx','utf8');
  assert.match(source,/if\(quickImportNotice\)/);
  assert.match(source,/quickExpectedTotal/);
  assert.match(source,/Number\(row\.costPrice\)<=0/);
});
