import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {customerDisplaySnapshot,openCustomerDisplay} from '../src/pages/posPro/customerDisplay.js';
test('customer screen displays totals without private cart or customer data',()=>{
 const snapshot=customerDisplaySnapshot({business:'Market',branch:'A',cart:[{name:'Olma',cartQty:2,unit:'kg',sellPrice:10000,discountPercent:10,costPrice:5000,customerId:'secret',sku:'hidden'}],cartPct:0});
 assert.equal(snapshot.state,'cart');assert.match(snapshot.total,/18[ ,]000/);
 assert.match(snapshot.lines[0].amount,/18[ ,]000/);
 assert.equal(snapshot.lines[0].quantity,'2 kg');
 assert.doesNotMatch(JSON.stringify(snapshot),/secret|hidden|costPrice|5000/);
 const done=customerDisplaySnapshot({cart:[],confirmedSale:{total:18000,customer:'PRIVATE',items:[{name:'Olma'}]}});
 assert.equal(done.state,'confirmed');assert.match(done.total,/18[ ,]000/);assert.doesNotMatch(JSON.stringify(done),/PRIVATE/);
});
test('popup rendering uses textContent and closes without exposing opener',()=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>');
 const popup=dom.window;let closed=false;
 const handle=openCustomerDisplay({open:()=>({document:popup.document,opener:{},get closed(){return closed},close(){closed=true},focus(){}})});
 assert.ok(handle.update({business:'<script>bad</script>',branch:'A',state:'cart',lines:[{name:'<img onerror=alert(1)>',quantity:'1 dona',amount:'100 so‘m'}],total:'100 so‘m'}));
 assert.equal(popup.document.querySelector('script,img'),null);assert.match(popup.document.body.textContent,/<img onerror=alert/);
 handle.close();assert.equal(handle.closed(),true);assert.equal(handle.update({}),false);dom.window.close();
 assert.throws(()=>openCustomerDisplay({open:()=>null}),/blokladi/);
});
