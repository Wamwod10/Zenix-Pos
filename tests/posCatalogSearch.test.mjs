import test from 'node:test';
import assert from 'node:assert/strict';
const {createPosCatalogSearch,searchPosCatalog}=await import('../src/utils/posCatalogSearch.js').catch(()=>({}));
const legacy=(products,search,category)=>products.filter(p=>!p.archived&&(category==='all'||p.category===category)&&`${p.name} ${p.sku||''} ${p.barcode||''}`.toLowerCase().includes(search.toLowerCase()));
test('indexed POS search preserves substring, category, order and original product identity',()=>{
 assert.equal(typeof createPosCatalogSearch,'function');
 const products=[{id:'a',name:'Guruch 25 kg',sku:'SKU-A',barcode:'00123',category:'Food',quantity:0},{id:'b',name:'Choy',category:'Drink'},{id:'c',name:'GURUCH',archived:true},{id:'d',name:'O‘rik',barcode:'123',category:'Food'}];
 const index=createPosCatalogSearch(products);
 for(const query of ['','g','GURUCH','25 kg','sku-a','00123','choy  ','O‘RIK','none'])for(const category of ['all','Food','Drink','unknown']){
  const actual=searchPosCatalog(index,query,category),expected=legacy(products,query,category);
  assert.deepEqual(actual,expected);
  actual.forEach((p,i)=>assert.equal(p,expected[i]));
 }
});
test('catalog replacement removes archived and previous tenant records without mutating input',()=>{
 assert.equal(typeof createPosCatalogSearch,'function');
 const first=Object.freeze([Object.freeze({id:'a',name:'Old',sellPrice:123.45})]);
 const index=createPosCatalogSearch(first);
 assert.equal(searchPosCatalog(index,'old','all')[0],first[0]);
 const next=createPosCatalogSearch([{id:'b',name:'New'},{...first[0],archived:true}]);
 assert.deepEqual(searchPosCatalog(next,'old','all'),[]);
 assert.deepEqual(searchPosCatalog(next,'','all').map(p=>p.id),['b']);
 assert.equal(first[0].sellPrice,123.45);
});
