import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {productCatalogPdf} from '../src/utils/productPdf.js';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
test('independent PDF parser opens Unicode catalog and extracts complete final page',async()=>{
 const fontBytes=new Uint8Array(fs.readFileSync('public/fonts/NotoSans.ttf'));
 const blob=productCatalogPdf(Array.from({length:1000},(_,i)=>({name:'Ўзбекистон Ғалла '+i,sku:'SKU-'+i,quantity:15.5,unit:'kg',sellPrice:12000})),{fontBytes,exportDate:'2026-10-10'});
 const pdf=await getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:false}).promise;
 assert.equal(pdf.numPages,36);const first=(await (await pdf.getPage(1)).getTextContent()).items.map(x=>x.str).join(' '),last=(await (await pdf.getPage(36)).getTextContent()).items.map(x=>x.str).join(' ');
 assert.ok(first.includes('Ўзбекистон Ғалла 0'));assert.ok(first.includes('15,5 kg')||first.includes('15.5 kg'));assert.ok(last.includes('SKU-999'));await pdf.cleanup?.();
});
