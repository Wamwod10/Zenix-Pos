import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receiptHtml} from '../src/pages/posPro/receiptFormat.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const basic={id:'confirmed',saleNumber:'S-123',store:'Filial A',sellerName:'Ali',createdAt:'2026-11-20T09:30:00Z',total:83000,subtotal:90000,discountTotal:7000,items:[{name:'Oziq-ovqat',unit:'dona',quantity:2,finalPrice:41500}]};
test('confirmed cash receipt contains ID, branch, tender, change and discount',()=>{
 const html=receiptHtml({...basic,paymentMethod:'cash',paymentBreakdown:{cash:83000},cashTendered:100000,change:17000},{business:'Savdo MChJ',branch:'Other branch',width:'58'});
 for(const text of ['size:58mm auto','Chek № S-123','Filial A','Kassir: Ali','Chegirma','Berildi','Qaytim','Bu fiskal soliq cheki emas'])assert.ok(html.includes(text),text);
 assert.match(html,/Berildi: <\/span><b>100[ ,]000/);assert.match(html,/Qaytim: <\/span><b>17[ ,]000/);
 assert.ok(!html.includes('Other branch'));
});
test('card and credit do not invent cash tender or change',()=>{
 const card=receiptHtml({...basic,paymentMethod:'card',paymentBreakdown:{card:83000},cashTendered:0,change:0});
 assert.doesNotMatch(card,/Berildi|Qaytim/);
 const credit=receiptHtml({...basic,paymentMethod:'credit',paymentBreakdown:{cash:10000},cashTendered:10000,creditAmount:73000,creditDueDate:'2026-12-31',customer:'Gulnoza'});
 assert.match(credit,/Nasiya/);assert.match(credit,/2026-12-31/);assert.match(credit,/Mijoz: Gulnoza/);
 assert.match(credit,/Berildi/);assert.doesNotMatch(credit,/Qaytim/);
});
test('server totals for weighted goods are authoritative',()=>{
 const html=receiptHtml({...basic,items:[{name:'Olma',quantity:1.501,unitPrice:18000,lineTotal:27018,metadata:{unit:'kg'}}],total:27018,discountTotal:0});
 assert.match(html,/1.501 kg/);assert.match(html,/27[ ,]018/);assert.doesNotMatch(html,/NaN/);
});
test('untrusted merchant settings and products are escaped',()=>{
 const html=receiptHtml({...basic,items:[{name:'<img src=x onerror=alert(1)>',quantity:1,finalPrice:83000}],customer:'<script>evil</script>'},{business:'<iframe>',footer:'<b>!</b>'});
 assert.doesNotMatch(html,/<script>|<iframe>|<img /);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;iframe&gt;/);assert.doesNotMatch(html,/<canvas|qr-code/);
});
test('copies are capped and receipt width is validated',()=>{
 assert.equal((receiptHtml(basic,{copies:3,width:'80'}).match(/class="paper"/g)||[]).length,3);
 assert.equal((receiptHtml(basic,{copies:40}).match(/class="paper"/g)||[]).length,3);
 assert.throws(()=>receiptHtml(basic,{width:'A4'}));assert.throws(()=>receiptHtml({...basic,items:[]}),/to‘liq/);
});
test('post-payment printing never invokes browser shell and preserves sale metadata',()=>{
 const sales=read('src/pages/sales/Sales.jsx'),pos=read('src/pages/posPro/PosPro.jsx'),store=read('src/context/StoreContext.jsx');
 assert.match(sales,/import \{receiptHtml,printReceipt\} from "\.\.\/posPro\/receiptFormat"/);
 assert.doesNotMatch(sales,/window\.print\(\)/);assert.match(sales,/receiptConfirmedHere\)printConfirmedReceipt/);
 assert.match(sales,/payment==="credit"\?Number\(creditPaid\|\|0\)/);
 assert.match(store,/cashTendered:sale\.cashTendered,change:sale\.change/);
 assert.match(pos,/copies:settings\.receipt\?\.copies\|\|1/);
 const history=read('src/pages/history/History.jsx');assert.doesNotMatch(history,/window\.print\(\)/);assert.match(history,/printHistoricalReceipt/);
});

test('historical reprint includes returned amount without altering original gross',()=>{
 const html=receiptHtml({...basic,returnedTotal:12000,paymentBreakdown:{cash:83000}});
 assert.match(html,/JAMI/);assert.match(html,/Qaytarilgan/);assert.match(html,/Sof/);
 assert.match(html,/71[ ,]000/);
});

test('merchant contact is opt-in, escaped, and dates follow organization preferences',()=>{
 const options={phone:'+998 90 123 45 67',address:'<Market>',dateFormat:'YYYY-MM-DD',timeFormat:'12'};
 const hidden=receiptHtml(basic,options);
 assert.doesNotMatch(hidden,/998 90 123 45 67|&lt;Market&gt;/);
 const visible=receiptHtml(basic,{...options,showPhone:true,showAddress:true,footer:''});
 assert.match(visible,/Tel: \+998 90 123 45 67/);
 assert.match(visible,/&lt;Market&gt;/);
 assert.match(visible,/2026-11-20 02:30 PM/);
 assert.doesNotMatch(visible,/Xaridingiz uchun rahmat/);
 const other=receiptHtml(basic,{dateFormat:'MM/DD/YYYY',timeFormat:'24'});
 assert.match(other,/11\/20\/2026 14:30/);
});
