import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {productCatalogPdf} from '../src/utils/productPdf.js';
test('embedded Unicode catalog preserves Cyrillic, unit, date and 100/1000/10000 rows',async()=>{
 const fontBytes=new Uint8Array(fs.readFileSync('public/fonts/NotoSans.ttf'));
 for(const count of [100,1000,10000]){
 const started=performance.now();const blob=productCatalogPdf(Array.from({length:count},(_,i)=>({name:'Ўзбекистон Ғалла '+i,sku:'SKU-'+i,barcode:'123456',category:'Meva',sellPrice:12000,quantity:15.5,unit:'kg'})),{fontBytes,storeName:'Filial A',exportDate:'2026-10-10'});
 const body=new TextDecoder('latin1').decode(await blob.arrayBuffer());
 assert.match(body,/\/FontFile2/);assert.match(body,/\/ToUnicode/);assert.ok(body.includes('040E'));
 assert.ok(body.includes(Array.from('2026-10-10').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('').toUpperCase()));assert.ok(body.includes('006B0067'));
 assert.equal((body.match(/\/Type \/Page /g)||[]).length,Math.ceil(count/28));
 assert.ok(performance.now()-started<10000);
 }
});
