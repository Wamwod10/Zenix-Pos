import test from 'node:test';
import assert from 'node:assert/strict';
import {createHidScanner,decodeWeightBarcode,ean13CheckDigit,validateWeightSchemes} from '../src/pages/posPro/hardware.js';
import {cartTotals,paymentPlan,addCartProduct,validateQuantity,allowedCartDiscount,quantityStep} from '../src/pages/posPro/model.js';
import {selectSearchResult} from '../src/pages/posPro/catalogSelection.js';
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
test('credit due dates require a real Gregorian day and cannot be in the past for the business timezone',()=>{
 const base={method:'credit',total:20000,tendered:5000,customerId:'customer',creditAllowed:true,todayISO:'2026-10-28'};
 for(const dueDate of ['2026-02-30','2026-02-29','2026-13-01','0000-01-01','2000-01-01']){
  assert.throws(()=>paymentPlan({...base,dueDate}),/sana|muddati/i,dueDate);
 }
 assert.equal(paymentPlan({...base,dueDate:'2026-10-28'}).credit,15000);
 assert.equal(paymentPlan({...base,dueDate:'2028-02-29'}).credit,15000);
});
test('58/80mm receipt escapes content and preserves exact paid/change amounts',()=>{
 const sale={id:'s',saleNumber:'S-1',createdAt:'2026-10-21T00:00:00Z',sellerName:'<script>bad</script>',total:12150.25,discountTotal:2850,cashTendered:15000,change:2849.75,paymentBreakdown:{cash:12150.25},items:[{name:'<img src=x>',unit:'kg',quantity:1.25,sellPrice:12000,finalPrice:9720.2}]};
 for(const width of ['58','80']){const html=receiptHtml(sale,{width,business:'Test market'});assert.ok(html.includes(`size:${width}mm auto`));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('1.25 kg'));assert.match(html,/2[ ,]849[.,]75/);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('https://'))}
 assert.throws(()=>receiptHtml(sale,{width:'200'}));
});
test('printed receipt sums repeated payment rows with exact cents and never loses a method',()=>{
 const sale={id:'S-many-payments',total:200,createdAt:'2026-10-30T00:00:00Z',
   items:[{name:'Test product',quantity:1,sellPrice:200,lineTotal:200}],
   payments:[
     {method:'cash',amount:'40.10'},
     {method:'cash',amount:'60.20'},
     {method:'card',amount:'39.70'},
     {method:'card',amount:'60.00'},
   ],
 };
 const html=receiptHtml(sale);
 assert.match(html,/Naqd: 100[,.]3(?:0)? so‘m/);
 assert.match(html,/Karta \(qo‘lda tasdiqlangan\): 99[,.]7(?:0)? so‘m/);
 assert.equal((html.match(/Naqd:/g)||[]).length,1);
 assert.equal((html.match(/Karta \(qo‘lda tasdiqlangan\):/g)||[]).length,1);
 assert.equal(sale.payments[0].amount,'40.10','printing must not mutate source rows');
 const canonical=receiptHtml({...sale,paymentBreakdown:{cash:110,card:90}});
 assert.match(canonical,/Naqd: 110 so‘m/,'canonical breakdown remains authoritative');
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
test('canonical server receipt preserves kg/l units, captured payments and cash change',()=>{
 const html=receiptHtml({sale_number:'S-server',total:'18000.00',created_at:'2026-10-21T05:00:00Z',metadata:{cashTendered:20000,change:2000},payments:[{method:'cash',amount:'8000.00'},{method:'card',amount:'10000.00'}],items:[{name:'Olma',quantity:.75,unitPrice:12000,lineTotal:9000,metadata:{unit:'kg'}},{name:'Sut',quantity:1.5,unitPrice:6000,lineTotal:9000,metadata:{unit:'l'}}]});
 assert.ok(html.includes('0.75 kg'));assert.ok(html.includes('1.5 l'));assert.match(html,/Naqd: 8[ ,]000/);assert.match(html,/Karta[^<]*10[ ,]000/);assert.match(html,/Berildi: 20[ ,]000/);assert.match(html,/Qaytim: 2[ ,]000/);assert.ok(html.includes('S-server'));
});
test('name/SKU selection never guesses among ambiguous or unavailable results',()=>{
 const first={id:'a',sku:'SKU-1',quantity:10},second={id:'b',sku:'SKU-2',quantity:10};
 assert.equal(selectSearchResult([first,second],'Mahsulot'),null);
 assert.equal(selectSearchResult([first,second],'sku-2'),second);
 assert.equal(selectSearchResult([first,second],'Mahsulot','a'),first);
 assert.equal(selectSearchResult([first,{...second,sku:'SKU-1'}],'SKU-1'),null);
 assert.equal(selectSearchResult([{...first,quantity:0}],'SKU-1'),null);
 assert.equal(selectSearchResult([first],''),null);
});
test('quantity buttons use 50g/50ml measured-unit steps and one piece',()=>{
 for(const unit of ['kg','kilogramm','l','litr'])assert.equal(quantityStep(unit),.05);
 for(const unit of ['g','gramm','gr','ml'])assert.equal(quantityStep(unit),50);
 assert.equal(quantityStep('dona'),1);assert.equal(Math.round((.75-quantityStep('kg'))*1000)/1000,.7);
});

test('POS Pro payment cannot be edited during checkout and quick cash buttons revoke stale terminal confirmation',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/pages/posPro/Payment.jsx',import.meta.url),'utf8');
 assert.match(source,/const changeTendered=next=>\{if\(busy\)return;setTendered\(next\);setConfirmed\(false\);setReviewed\(false\)\}/);
 for(const label of ['Karta summasi','O‘tkazma summasi','Mijoz bergan naqd']){
   assert.ok(source.includes('aria-label="'+label+'" disabled={busy}'),label+' locked while saving');
 }
 assert.ok(source.includes('aria-label="Nasiya muddati" disabled={busy}'));
 assert.ok(source.includes('disabled={busy} checked={externalConfirmed}'));
 for(const action of ['Aniq summa','Tozalash']){
   assert.ok(source.includes('disabled={busy} onClick={()=>changeTendered('),action+' respects busy guard');
 }
});
