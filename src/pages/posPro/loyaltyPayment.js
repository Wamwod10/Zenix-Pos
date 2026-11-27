import {sumMoney,roundMoney} from '../../utils/posMoney.js';
export function validateRedemptionQuote(quote,total,points){
 if(!quote?.enabled||!Number.isSafeInteger(quote.maxPoints)||quote.maxPoints<0||quote.points!==points||points>quote.maxPoints||!Number.isFinite(quote.amount)||quote.amount<0||roundMoney(quote.amount)!==quote.amount||points>0&&quote.amount===0||points===0&&quote.amount!==0||quote.amount>total||sumMoney([quote.amount,quote.remaining])!==total)throw Error('Bonus hisobi noto‘g‘ri. Yangilang.');
 return quote;
}
export function loyaltyPaymentAmount(total,redemption,method){
 if(!redemption)return total;
 if(method==='credit'||!Number.isSafeInteger(redemption.points)||redemption.points<1||!Number.isFinite(redemption.amount)||redemption.amount<=0||redemption.amount>total||roundMoney(redemption.amount)!==redemption.amount)throw Error('Bonus to‘lovi noto‘g‘ri');
 return sumMoney([total,-redemption.amount]);
}
