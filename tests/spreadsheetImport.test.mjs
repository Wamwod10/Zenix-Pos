import test from 'node:test';
import assert from 'node:assert/strict';
import { cellToText, parseCsvText } from '../src/utils/spreadsheetImport.js';

test('CSV parser keeps identifier strings with leading zeroes',()=>{
  const parsed=parseCsvText('Barcode,IMEI,Product\n001234567890,001234567890123,iPhone\n');
  assert.equal(parsed.headers[0],'Barcode');
  assert.equal(cellToText(parsed.rows[0][0],{identifier:true}),'001234567890');
  assert.equal(cellToText(parsed.rows[0][1],{identifier:true}),'001234567890123');
});

test('identifier conversion expands scientific notation without Number precision loss',()=>{
  assert.equal(cellToText({value:'1.23456789012345E+14'},{identifier:true}),'123456789012345');
  assert.equal(cellToText({value:'1.234E-3'},{identifier:true}),'0.001234');
});

test('Excel zero format can restore identifier padding',()=>{
  assert.equal(cellToText({value:'1234567890',format:'000000000000'},{identifier:true}),'001234567890');
});

test('semicolon and tab separated CSV are recognized',()=>{
  assert.deepEqual(parseCsvText('Nomi;Barcode\nCola;0012').headers,['Nomi','Barcode']);
  assert.deepEqual(parseCsvText('Nomi\tBarcode\nCola\t0012').headers,['Nomi','Barcode']);
});
