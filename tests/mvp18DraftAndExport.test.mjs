import test from 'node:test';import assert from 'node:assert/strict';
import {posDraftKey,readPosDraft,savePosDraft,clearPosDraft} from '../src/utils/posDraft.js';
import {productCatalogPdf} from '../src/utils/productPdf.js';
test('draft survives refresh, scoped per tenant/user/store',()=>{
 const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const a=posDraftKey('A','cashier','store1'),b=posDraftKey('B','cashier','store1');
 assert.equal(savePosDraft(storage,a,{cart:[{id:'product',cartQty:3}]}),true);
 assert.equal(readPosDraft(storage,a).cart[0].cartQty,3);
 assert.equal(readPosDraft(storage,b),null);
 clearPosDraft(storage,a);assert.equal(readPosDraft(storage,a),null);
});
test('product exporter creates valid PDF header and product fields',async()=>{
 const bytes=new Uint8Array(await productCatalogPdf([{name:'Olma',sku:'ME-01',barcode:'123456',category:'Meva',sellPrice:12000,quantity:15}]).arrayBuffer());
 const body=new TextDecoder().decode(bytes);
 assert.ok(body.startsWith('%PDF-1.4'));
 assert.ok(body.includes('Olma'));
 assert.ok(body.includes('12000'));
});
