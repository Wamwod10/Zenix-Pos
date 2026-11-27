import {lineAmount,sumMoney} from '../../utils/posMoney.js';
export function promotionItems(cart,cartPct){
 if(Number(cartPct)!==0)return [];
 return cart.filter(p=>p.unit==='dona'&&!p.packUnit&&!Number(p.discountPercent||0)&&Number.isSafeInteger(p.cartQty)&&p.cartQty>0&&p.cartQty<=1000000).map(p=>({productId:p.id,quantity:p.cartQty}));
}
export function applyPromotionQuotes(cart,cartPct,quotes){
 if(!Array.isArray(quotes))throw Error('Aksiya hisobi noto‘g‘ri');
 const eligible=new Set(promotionItems(cart,cartPct).map(p=>p.productId)),byId=new Map();
 for(const q of quotes){
  if(!q||!eligible.has(q.productId)||byId.has(q.productId)||typeof q.ruleId!=='string'||!q.ruleId||!Number.isFinite(q.net)||!Number.isFinite(q.discount)||q.net<0||q.discount<=0)throw Error('Aksiya hisobi noto‘g‘ri');
  byId.set(q.productId,q);
 }
 return cart.map(p=>{
  const q=byId.get(p.id);if(!q)return p;
  const gross=lineAmount(p.cartQty,p.sellPrice);
  if(q.gross!==gross||sumMoney([q.net,q.discount])!==gross)throw Error('Aksiya narxi o‘zgardi. Savatni yangilang.');
  return {...p,promotionQuote:{ruleId:q.ruleId,net:q.net},promotionNet:q.net};
 });
}
export const promotionSignature=lines=>JSON.stringify(lines.filter(p=>p.promotionQuote).map(p=>[p.id,p.promotionQuote.ruleId,p.promotionQuote.net]));
