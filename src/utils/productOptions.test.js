import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePackaging, packagingReceiptTotals, validateProductOptions } from './productOptions.js';
test('packaging retains independent price and converts receipts to base units',()=>{
 const options=normalizePackaging([{unit:'quti',factor:'24',salePrice:'12000',extra:'retained'}]);
 assert.deepEqual(options,[{unit:'quti',factor:24,salePrice:12000,extra:'retained'}]);
 assert.deepEqual(packagingReceiptTotals(2,24000,options[0]),{baseQuantity:48,totalCost:48000,baseUnitCost:1000});
});
test('invalid conversion, price and reversed expiry are rejected',()=>{
 assert.throws(()=>normalizePackaging([{unit:'quti',factor:0,salePrice:10}]));
 assert.throws(()=>normalizePackaging([{unit:'quti',factor:24,salePrice:Infinity}]));
 assert.ok(validateProductOptions({manufacturedDate:'2026-03-02',expiryDate:'2026-03-01'}).expiryDate);
});
test('packaging units are unique and factors match three decimal stock precision',()=>{
 for(const factor of [0.0001,1000001,1.2345])assert.throws(()=>normalizePackaging([{unit:'quti',factor,salePrice:1}]));
 assert.throws(()=>normalizePackaging([{unit:'quti',factor:24,salePrice:1},{unit:'quti',factor:12,salePrice:2}]));
 assert.equal(normalizePackaging([{unit:'quti',factor:1.001,salePrice:1}])[0].factor,1.001);
 assert.throws(()=>packagingReceiptTotals(0.001,1,{factor:0.001}));
 assert.equal(packagingReceiptTotals(0.1,1,{factor:0.1}).baseQuantity,0.01);
});
