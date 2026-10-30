import {formatProMoney as formatPrice} from './model.js';
import {sumMoney} from '../../utils/posMoney.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={cash:'Naqd',card:'Karta (qo‘lda tasdiqlangan)',transfer:'O‘tkazma (qo‘lda tasdiqlangan)',split:'Aralash',credit:'Nasiya'};
export function receiptHtml(sale,{width='80',business='ZENIX POS',branch='',cashier=''}={}){
 if(!['58','80'].includes(String(width)))throw Error('Unsupported receipt width');
 const rows=(sale.items||[]).map(p=>`<tr><td colspan="2">${escape(p.name)}</td></tr><tr><td>${escape(p.quantity??p.cartQty)} ${escape(p.unit||p.metadata?.unit||'dona')} × ${escape(formatPrice(p.sellPrice??p.unitPrice??p.price))}${p.discountPercent||sale.cartDiscountPercent?`<br>Chegirma: ${escape(p.discountPercent||0)}% + ${escape(sale.cartDiscountPercent||0)}%`:''}</td><td>${escape(formatPrice(p.lineTotal??Number(p.quantity??p.cartQty)*Number(p.finalPrice??p.unitPrice??p.price)))}</td></tr>`).join('');
 const payments=sale.paymentBreakdown||(Array.isArray(sale.payments)
  ?sale.payments.reduce((totals,payment)=>{
    const method=String(payment.method||'unknown');
    totals[method]=sumMoney([totals[method]||0,payment.amount??0]);
    return totals;
  },Object.create(null))
  :{[sale.paymentMethod||sale.metadata?.paymentMethod]:sale.total});
 return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Chek ${escape(sale.saleNumber||sale.sale_number||sale.id)}</title><style>@page{size:${width}mm auto;margin:2mm}*{box-sizing:border-box}body{font:12px monospace;color:#000;background:white;width:${Number(width)-4}mm;margin:0;padding:2mm}h1{font-size:17px;text-align:center}p{margin:5px 0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:3px 0;overflow-wrap:anywhere}td:last-child{text-align:right}hr{border:0;border-top:1px dashed #000}.total{font-size:18px;font-weight:bold}small{display:block;text-align:center;margin-top:12px}</style></head><body><h1>${escape(business)}</h1><p>${escape(branch||sale.store)}</p><p>Chek: ${escape(sale.saleNumber||sale.sale_number||sale.id)}</p><p>${escape(new Date(sale.createdAt||sale.created_at||Date.now()).toLocaleString('uz-UZ'))}</p><p>Kassir: ${escape(sale.sellerName||cashier)}</p><hr><table>${rows}</table><hr><p>Chegirma: ${escape(formatPrice(sale.discountTotal||0))}</p><p class="total">JAMI: ${escape(formatPrice(sale.total))}</p>${Object.entries(payments).filter(([,n])=>Number(n)>0).map(([k,n])=>`<p>${escape(labels[k]||k)}: ${escape(formatPrice(n))}</p>`).join('')}${sale.creditAmount>0?`<p>Nasiya: ${escape(formatPrice(sale.creditAmount))}</p>`:''}<p>Berildi: ${escape(formatPrice(sale.cashTendered??sale.metadata?.cashTendered??0))}</p><p>Qaytim: ${escape(formatPrice(sale.change??sale.metadata?.change??0))}</p><small>Xaridingiz uchun rahmat.<br>Bu fiskal soliq cheki emas.</small></body></html>`;
}
export function printReceipt(sale,options){
 const frame=document.createElement('iframe');frame.title='POS Pro chek';frame.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';
 frame.onload=()=>{frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow.focus();frame.contentWindow.print()};
 frame.srcdoc=receiptHtml(sale,options);document.body.append(frame);
}
