import test from 'node:test';
import assert from 'node:assert/strict';
import {matchReceiptProduct,validateReceiptIdentities,prepareReceiptIdentities} from '../src/utils/productIdentity.js';
const catalog=[{id:'a',name:'Cola',barcode:'111',sku:'COLA-1'},{id:'b',name:'Cola',barcode:'222',sku:'COLA-2'}];
test('same name is never a receipt identity; explicit barcode and SKU select variants',()=>{
 assert.equal(matchReceiptProduct(catalog,{name:'Cola'}),null);
 assert.equal(matchReceiptProduct(catalog,{name:'Cola',barcode:'222'}).id,'b');
 assert.equal(matchReceiptProduct(catalog,{sku:'cola-1'}).id,'a');
 assert.equal(matchReceiptProduct(catalog,{barcode:'333',sku:'COLA-1'}),null);
 assert.equal(matchReceiptProduct(catalog,{barcode:'111',sku:'COLA-2'}),null);
});
test('two same-name new variants get independent barcodes and SKUs',async()=>{
 const rows=[{name:'Cola',sellPrice:5000,unit:'dona',qty:3},{name:'Cola',sellPrice:9000,unit:'litr',qty:2}];
 const codes=['111','333','333','444'];
 const prepared=await prepareReceiptIdentities(rows,catalog,async()=>({success:true,barcode:codes.shift()}));
 assert.deepEqual(prepared.map(p=>[p.name,p.barcode,p.sku,p.sellPrice,p.unit,p.createNew]),[['Cola','333','BC-333',5000,'dona',true],['Cola','444','BC-444',9000,'litr',true]]);
 assert.equal(rows[0].barcode,undefined);
});
test('manual identifiers stay unique and existing product receipts keep their ID',async()=>{
 assert.throws(()=>validateReceiptIdentities([{name:'Cola',barcode:'111'}],catalog),/shtrix-kod/);
 assert.throws(()=>validateReceiptIdentities([{name:'Cola',sku:'cola-1'}],catalog),/SKU/);
 assert.throws(()=>validateReceiptIdentities([{name:'X',barcode:'333'},{name:'Y',barcode:'333'}],catalog),/shtrix-kod/);
 assert.throws(()=>validateReceiptIdentities([{productId:'a'},{productId:'a'}],catalog),/ikki marta/);
 const rows=[{productId:'a',name:'Cola',barcode:'111',sku:'COLA-1'},{name:'Cola',barcode:'333'}];
 const result=await prepareReceiptIdentities(rows,catalog,()=>{throw Error('must not generate')});
 assert.equal(result[0].productId,'a');assert.equal(result[0].createNew,undefined);assert.equal(result[1].sku,'BC-333');
});
