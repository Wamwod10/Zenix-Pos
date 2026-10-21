import test from 'node:test';
import assert from 'node:assert/strict';
import {createHidScanner,decodeWeightBarcode,ean13CheckDigit,validateWeightSchemes} from '../src/pages/posPro/hardware.js';
import {cartTotals,paymentPlan,addCartProduct,validateQuantity,allowedCartDiscount} from '../src/pages/posPro/model.js';
import {receiptHtml} from '../src/pages/posPro/receiptFormat.js';
import {posDraftKey,savePosDraft,readPosDraft} from '../src/utils/posDraft.js';
const product={id:'p',name:'Olma',sellPrice:12000,unit:'kg',quantity:100};
const scheme={prefix:'21',productStart:2,productLength:5,valueStart:7,valueLength:5,divisor:1000,unit:'kg'};
const label=body=>body+ean13CheckDigit(body);
test('HID accepts fast Enter-terminated bursts exactly once; ignores typing, repeats, password and modal',()=>{
 const scans=[],scanner=createHidScanner(code=>scans.push(code));let now=100;
 const send=(text,gap=8,extra={})=>{for(const key of [...text,'Enter']){now+=gap;scanner.key({key,...extra},now)}};
 send('12345678');send('12345678');assert.deepEqual(scans,['12345678','12345678']);
 send('12345678',180);send('12345678',8,{editable:true});send('12345678',8,{blocked:true});send('12345678',8,{repeat:true});
 assert.equal(scans.length,2);
 for(let i=0;i<8;i++)send('12345678');assert.equal(scans.length,10);
});
test('weighted EAN requires checksum and explicit unambiguous configuration',()=>{
 const code=label('210012301250');
 assert.deepEqual(decodeWeightBarcode(code,[scheme]),{productCode:'00123',quantity:1.25,unit:'kg'});
 assert.equal(decodeWeightBarcode(code,[]),null);
 assert.equal(decodeWeightBarcode(label('220012301250'),[scheme]),null);
 assert.throws(()=>decodeWeightBarcode(code.slice(0,-1)+(code.at(-1)==='0'?'1':'0'),[scheme]),/checksum/i);
 assert.throws(()=>decodeWeightBarcode(code,[scheme,scheme]),/configuration/i);
 assert.throws(()=>decodeWeightBarcode(code,[{...scheme,valueStart:2}]),/configuration/i);
 assert.throws(()=>validateWeightSchemes([{...scheme,productLength:-1}]),/configuration/i);
});
test('repeat scans, fractional quantities, combined discounts and stock',()=>{
 let cart=[];for(let i=0;i<10;i++)cart=addCartProduct(cart,product,1);
 assert.equal(cart[0].cartQty,10);assert.equal(cart.length,1);
 assert.throws(()=>addCartProduct(cart,product,100),/qoldiq/i);
 assert.throws(()=>validateQuantity(0));assert.throws(()=>validateQuantity(1.0001));
 assert.deepEqual(cartTotals([{...product,cartQty:1.25,discountPercent:10}],10),{subtotal:15000,total:12150,discount:2850,lines:1});
});
test('cash change, split, credit and external confirmation',()=>{
 assert.deepEqual(paymentPlan({method:'cash',total:127000,tendered:150000}),{breakdown:{cash:127000,card:0,transfer:0},credit:0,change:23000,tendered:150000});
 assert.deepEqual(paymentPlan({method:'split',total:180000,tendered:80000,card:100000,externalConfirmed:true}).breakdown,{cash:80000,card:100000,transfer:0});
 for(const input of [{method:'cash',tendered:-1},{method:'cash',tendered:1},{method:'card'},{method:'split',card:200000},{method:'credit'},{method:'split',tendered:180000}])assert.throws(()=>paymentPlan({total:180000,...input}));
 assert.equal(paymentPlan({method:'credit',total:180000,tendered:20000,customerId:'c',dueDate:'2026-12-01',creditAllowed:true}).credit,160000);
});
test('58/80mm receipt escapes content and preserves exact paid/change amounts',()=>{
 const sale={id:'s',saleNumber:'S-1',createdAt:'2026-10-21T00:00:00Z',sellerName:'<script>bad</script>',total:12150.25,discountTotal:2850,cashTendered:15000,change:2849.75,paymentBreakdown:{cash:12150.25},items:[{name:'<img src=x>',unit:'kg',quantity:1.25,sellPrice:12000,finalPrice:9720.2}]};
 for(const width of ['58','80']){const html=receiptHtml(sale,{width,business:'Test market'});assert.ok(html.includes(`size:${width}mm auto`));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('1.25 kg'));assert.match(html,/2[ ,]849[.,]75/);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('https://'))}
 assert.throws(()=>receiptHtml(sale,{width:'200'}));
});
test('500-line draft roundtrip is separate from ordinary Sales',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const base=posDraftKey('org','user','store'),key=base+':pro';
 assert.equal(savePosDraft(storage,key,{cart:Array.from({length:500},(_,i)=>({...product,id:String(i),cartQty:1.25}))}),true);
 assert.equal(readPosDraft(storage,key).cart.length,500);assert.equal(readPosDraft(storage,base),null);
 assert.equal(readPosDraft(storage,key).cart[0].unit,'kg');
});
test('restored basket discount respects revoked permission and combined discount limit',()=>{
 assert.equal(allowedCartDiscount([{discountPercent:10}],20,false,20),0);
 assert.ok(allowedCartDiscount([{discountPercent:10}],20,true,20)<11.112);
 assert.equal(allowedCartDiscount([],10,true,20),10);
});
