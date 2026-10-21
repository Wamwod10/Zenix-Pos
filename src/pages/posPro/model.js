import {lineAmount,roundMoney,sumMoney} from '../../utils/posMoney.js';
export const MAX_CART_LINES=500;
export const formatProMoney=value=>`${new Intl.NumberFormat('uz-UZ',{maximumFractionDigits:2}).format(Number(value||0)).replaceAll('\u00a0',' ')} so‘m`;
export const effectiveDiscount=(itemPct=0,cartPct=0)=>(1-(1-Number(itemPct)/100)*(1-Number(cartPct)/100))*100;
export const finalUnitPrice=(line,cartPct=0)=>Number(line.sellPrice)*(1-Number(line.discountPercent||0)/100)*(1-Number(cartPct)/100);
export function allowedCartDiscount(lines,requested,allowed,limit){
 if(!allowed)return 0;
 const maximum=lines.reduce((cap,line)=>{const item=Number(line.discountPercent||0);return Math.min(cap,item>=100?0:Math.max(0,(Number(limit)-item)/(100-item)*100))},Math.max(0,Math.min(100,Number(limit))));
 return Math.max(0,Math.min(maximum,Number(requested)||0));
}
export function validateQuantity(value){
 const n=Number(value);if(!Number.isFinite(n)||n<=0||n>999999999||Math.abs(n*1000-Math.round(n*1000))>0.00001)throw Error('Miqdor musbat, ko‘pi bilan 3 kasr belgili bo‘lsin');return n;
}
export function addCartProduct(cart,product,quantity=1){
 const q=validateQuantity(quantity);if(product.archived)throw Error('Mahsulot arxivlangan');
 const existing=cart.find(p=>p.id===product.id),nextQty=Math.round(((existing?.cartQty||0)+q)*1000)/1000;
 if(nextQty>Number(product.quantity??product.stock??0))throw Error(`${product.name}: qoldiq yetarli emas`);
 if(!existing&&cart.length>=MAX_CART_LINES)throw Error(`Chekda ko‘pi bilan ${MAX_CART_LINES} mahsulot`);
 return existing?cart.map(p=>p.id===product.id?{...p,...product,cartQty:nextQty,discountPercent:p.discountPercent,tracking:p.tracking}:p):[...cart,{...product,cartQty:q,discountPercent:0}];
}
export function cartTotals(cart,cartPct=0){
 if(!Number.isFinite(Number(cartPct))||cartPct<0||cartPct>100)throw Error('Chegirma noto‘g‘ri');
 const subtotal=sumMoney(cart.map(p=>lineAmount(p.cartQty,p.sellPrice)));
 const total=sumMoney(cart.map(p=>lineAmount(p.cartQty,finalUnitPrice(p,cartPct))));
 return {subtotal,total,discount:sumMoney([subtotal,-total]),lines:cart.length};
}
const amount=value=>{const n=Number(value||0);if(!Number.isFinite(n)||n<0||roundMoney(n)!==n||n>9000000000000)throw Error('To‘lov summasi noto‘g‘ri');return n};
export function paymentPlan({method,total,tendered=0,card=0,transfer=0,externalConfirmed=false,customerId,dueDate,creditAllowed=false}){
 total=amount(total);tendered=amount(tendered);card=amount(card);transfer=amount(transfer);
 if(!['cash','card','transfer','split','credit'].includes(method))throw Error('To‘lov turini tanlang');
 let cash=0,credit=0;
 if(method==='cash')cash=total;
 if(method==='card')card=total;
 if(method==='transfer')transfer=total;
 if(method==='credit'){
  if(!creditAllowed||!customerId||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate||''))throw Error('Nasiya uchun ruxsat, mijoz va muddat kerak');
  if(tendered>total)throw Error('Boshlang‘ich to‘lov jami summadan oshdi');cash=tendered;credit=sumMoney([total,-cash]);
 }
 if(method==='split'){
  cash=sumMoney([total,-card,-transfer]);if(cash<0)throw Error('Karta va o‘tkazma jami summadan oshdi');
  if([cash,card,transfer].filter(n=>n>0).length<2)throw Error('Aralash to‘lovda kamida ikki usul kerak');
 }
 if(cash>tendered)throw Error('Mijoz bergan naqd yetarli emas');
 if((card>0||transfer>0)&&!externalConfirmed)throw Error('Terminal / o‘tkazma to‘lovini qo‘lda tasdiqlang');
 return {breakdown:{cash,card,transfer},credit,change:cash>0?sumMoney([tendered,-cash]):0,tendered};
}
