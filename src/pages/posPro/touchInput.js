// Input editing only. Checkout and discount authorization stay in useProSession.
export function touchKey(value,key){
 if(key==='clear')return '';
 if(key==='backspace')return value.slice(0,-1);
 if(!/^(\d|00|\.)$/.test(key)||value.length>=15)return value;
 if(key==='.'&&value.includes('.'))return value;
 if(key==='.')return value?value+'.':'0.';
 return value==='0'||!value?String(Number(key)):value+key;
}
export function priceDiscount(unitPrice,targetPrice,cartPct=0){
 const base=Number(unitPrice)*(1-Number(cartPct)/100),target=Number(targetPrice);
 if(!Number.isFinite(base)||base<0||!Number.isFinite(target)||target<0||target>base)throw Error('Narxni faqat mavjud chegirma doirasida pasaytirish mumkin');
 if(Math.abs(target*100-Math.round(target*100))>.00001)throw Error('Narxda ko‘pi bilan 2 kasr belgi kiriting');
 return base===0?0:(base-target)/base*100;
}
