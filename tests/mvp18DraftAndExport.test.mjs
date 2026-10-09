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
test('PDF catalog transliterates Cyrillic names, categories and search labels readably',async()=>{
 const products=[
  {name:'Олма',category:'Мева',sku:'ҚИДИРУВ'},
  {name:'Ўзбекистон Ғалла Ҳосил Қовун',category:'ЎРИК ҒЎЗА'},
  {name:'Ёжик Щука Чай Жук',category:'Сыр Эхо Юла Яблоко'},
  {name:'ЖУК ЧАЙ ШАР ЩУКА',category:'Объект тень'},
 ];
 const body=new TextDecoder().decode(await productCatalogPdf(products).arrayBuffer());
 for(const text of ['Olma','Meva','QIDIRUV',"O'zbekiston G'alla Hosil Qovun","O'RIK G'O'ZA",'Yozhik Shchuka Chay Zhuk','Syr Ekho Yu','ZHUK CHAY SHAR SHCHUKA',"Ob'ekt ten"]){
  assert.ok(body.includes(text),`missing readable transliteration: ${text}`);
 }
 assert.ok(!body.includes('?'),'ordinary Cyrillic catalog text must not become question marks');
});
