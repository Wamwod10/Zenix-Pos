import {formatProMoney as formatPrice} from './model.js';
import {lineAmount,sumMoney} from '../../utils/posMoney.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={cash:'Naqd',card:'Karta (qo‘lda tasdiqlangan)',transfer:'O‘tkazma (qo‘lda tasdiqlangan)',split:'Aralash',credit:'Nasiya'};
const money=value=>Number.isFinite(Number(value))?Number(value):0;
const exists=value=>value!==null&&value!==undefined&&value!=='';
function paymentAmounts(sale){
 if(sale.paymentBreakdown&&typeof sale.paymentBreakdown==='object')return sale.paymentBreakdown;
 if(Array.isArray(sale.payments))return sale.payments.reduce((total,row)=>{
  const method=String(row.method||'unknown');
  total[method]=sumMoney([total[method]||0,row.amount??0]);return total;
 },Object.create(null));
 const method=sale.paymentMethod||sale.metadata?.paymentMethod||'cash';
 return method==='credit'?{cash:money(sale.cashTendered??sale.metadata?.cashTendered)}:{[method]:money(sale.total??sale.saleTotal)};
}
function receiptDate(sale,timezone){
 const value=sale.createdAt||sale.created_at, date=value?new Date(value):null;
 if(date&&Number.isFinite(date.getTime())){
  const format=zone=>new Intl.DateTimeFormat('uz-UZ',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
  try{return format(timezone)}catch{return format('Asia/Tashkent')}
 }
 return [sale.date||sale.dateISO,sale.time].filter(Boolean).join(' ')||'Sana mavjud emas';
}
function receiptRows(sale){
 return sale.items.map(item=>{
  const qty=item.quantity??item.qty??item.cartQty??0;
  const unit=item.unit||item.metadata?.unit||'dona';
  const price=item.finalPrice??item.unitPrice??item.price??item.sellPrice??0;
  const paid=item.lineTotal??lineAmount(qty,price);
  const itemDiscount=Number(item.discountPercent||item.metadata?.itemDiscountPercent||0);
  const basketDiscount=Number(item.cartDiscountPercent??sale.cartDiscountPercent??item.metadata?.cartDiscountPercent??0);
  const discount=[itemDiscount>0?`Mahsulot ${itemDiscount}%`:null,basketDiscount>0?`Savat ${basketDiscount}%`:null].filter(Boolean).join(' · ');
  return `<tr class="item-name"><td colspan="2">${escape(item.name||'Mahsulot')}</td></tr><tr class="item-detail"><td>${escape(qty)} ${escape(unit)} × ${escape(formatPrice(price))}${discount?`<br><span class="discount">${escape(discount)}</span>`:''}</td><td>${escape(formatPrice(paid))}</td></tr>`;
 }).join('');
}
export function receiptHtml(sale,{width='80',business='ZENIX POS',branch='',cashier='',showLogo=true,showCashier=true,showPaymentBreakdown=true,footer='Xaridingiz uchun rahmat.',timezone='Asia/Tashkent',copies=1}={}){
 const paper=String(width);
 if(!['58','80'].includes(paper))throw Error('Unsupported receipt width');
 if(!sale||!Array.isArray(sale.items)||!sale.items.length)throw Error('Tasdiqlangan chek ma’lumotlari to‘liq emas');
 const quantity=Math.max(1,Math.min(3,Math.floor(Number(copies)||1)));
 const breakdown=paymentAmounts(sale), method=sale.paymentMethod||sale.metadata?.paymentMethod||'cash';
 const payments=showPaymentBreakdown
  ?Object.entries(breakdown).filter(([,n])=>money(n)>0).map(([name,n])=>`<p class="row"><span>${escape(labels[name]||name)}: </span><b>${escape(formatPrice(n))}</b></p>`).join('')
  :`<p class="row"><span>To‘lov: </span><b>${escape(labels[method]||method)}</b></p>`;
 const credit=money(sale.creditAmount),cash=money(breakdown.cash),tender=sale.cashTendered??sale.metadata?.cashTendered,change=sale.change??sale.metadata?.change;
 const customer=typeof sale.customer==='object'?sale.customer?.name:sale.customer;
 const total=sale.total??sale.saleTotal??0,discount=sale.discountTotal??sale.metadata?.frontendDiscountTotal??0,returned=money(sale.returnedTotal);
 const number=sale.saleNumber||sale.sale_number||sale.clientReference||sale.id||'—';
 const clerk=sale.sellerName||sale.seller||cashier;
 const due=sale.creditDueDate||sale.credit_due_date;
 const paperBody=`<main class="paper">
 <header><h1>${escape(business)}</h1>${showLogo?'<small class="brand">ZENIX POS</small>':''}<p>${escape(sale.store||branch||'Filial')}</p></header>
 <div class="rule"></div><p>Chek № ${escape(number)}</p><p>${escape(receiptDate(sale,timezone))}</p>
 ${showCashier&&clerk?`<p>Kassir: ${escape(clerk)}</p>`:''}${customer?`<p>Mijoz: ${escape(customer)}</p>`:''}
 <div class="rule"></div><table aria-label="Mahsulotlar"><tbody>${receiptRows(sale)}</tbody></table><div class="rule"></div>
 ${money(discount)>0?`<p class="row"><span>Chegirma</span><b>−${escape(formatPrice(discount))}</b></p>`:''}
 <p class="row grand"><span>JAMI</span><b>${escape(formatPrice(total))}</b></p>${returned>0?`<p class="row"><span>Qaytarilgan: </span><b>−${escape(formatPrice(returned))}</b></p><p class="row"><span>Sof: </span><b>${escape(formatPrice(Math.max(0,money(total)-returned)))}</b></p>`:``}<div class="rule"></div>${payments}
 ${credit>0?`<p class="row"><span>Nasiya: </span><b>${escape(formatPrice(credit))}</b></p>`:''}${credit>0&&due?`<p>Nasiya muddati: ${escape(due)}</p>`:''}
 ${cash>0&&exists(tender)?`<p class="row"><span>Berildi: </span><b>${escape(formatPrice(tender))}</b></p>`:''}
 ${cash>0&&exists(change)?`<p class="row"><span>Qaytim: </span><b>${escape(formatPrice(change))}</b></p>`:''}
 <footer><p>${escape(footer)}</p><small>Bu fiskal soliq cheki emas.</small></footer></main>`;
 return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Chek ${escape(number)}</title><style>
 @page{size:${paper}mm auto;margin:2mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}
 body{font:12px/1.42 ui-monospace,SFMono-Regular,Consolas,"Courier New",monospace}
 .paper{width:${Number(paper)-4}mm;max-width:100%;margin:0 auto;padding:1mm 0 2mm;overflow-wrap:anywhere;break-after:page}
 .paper:last-child{break-after:auto}h1{font-size:17px;line-height:1.2;margin:0 0 3px;font-weight:700;overflow-wrap:anywhere}
 header,footer{text-align:center}header p{margin:3px 0}.brand{display:block;font-size:9px;letter-spacing:.07em}
 p{margin:5px 0;overflow-wrap:anywhere}.rule{border-top:1px dashed #111;margin:9px 0}
 table{width:100%;border-collapse:collapse;table-layout:fixed}td{padding:1px 0;vertical-align:top;overflow-wrap:anywhere}
 .item-detail td:last-child{text-align:right;width:39%}.item-name td{text-align:left;font-weight:650;padding-top:6px}
 .item-detail td{padding-bottom:6px}.discount{font-size:10px;color:#333}
 .row{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}
 .row span{min-width:0;flex:1}.row b{max-width:57%;overflow-wrap:anywhere;text-align:right;font-weight:650}
 .grand{font-size:17px;font-weight:700;line-height:1.25}.grand b{font-size:18px}
 footer{margin-top:16px;font-size:11px}footer small{display:block;margin-top:7px;font-size:10px}
 @media print{.paper{max-width:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 </style></head><body>${Array.from({length:quantity},()=>paperBody).join('')}</body></html>`;
}
export function printReceipt(sale,options,onError){
 let markup;
 try{markup=receiptHtml(sale,options)}catch(error){onError?.(error);return}
 const frame=document.createElement('iframe');
 frame.title='POS Pro chek';
 frame.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';
 let cleaned=false;
 const cleanup=()=>{if(cleaned)return;cleaned=true;clearTimeout(fallback);frame.remove()};
 // Some browsers never dispatch afterprint, including blocked or cancelled print dialogs.
 const fallback=setTimeout(cleanup,180000);
 const fail=error=>{cleanup();onError?.(error instanceof Error?error:new Error('Printer oynasini ochib bo‘lmadi'))};
 frame.onerror=()=>fail(new Error('Chekni chop etish oynasi yuklanmadi'));
 frame.onload=()=>{
  if(cleaned)return;
  try{
   const target=frame.contentWindow;
   if(!target?.print)throw Error('Brauzer chop etishni qo‘llab-quvvatlamadi');
   target.addEventListener('afterprint',cleanup,{once:true});
   target.focus();target.print();
  }catch(error){fail(error)}
 };
 try{frame.srcdoc=markup;document.body.append(frame)}catch(error){fail(error)}
}
