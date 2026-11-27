const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer=(value,max)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('Musbat butun son kiriting.');return n};
function utc(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Aksiya vaqtini kiriting.');
 const date=new Date(value+':00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,16)!==value)throw Error('Aksiya vaqti noto‘g‘ri.');
 return date.toISOString();
}
export function buildPromotionRule(form,id){
 if(!uuid.test(id)||!uuid.test(form.productId))throw Error('Mahsulotni tanlang.');
 const storeIds=[...new Set(form.storeIds||[])];
 if(storeIds.some(x=>!uuid.test(x))||storeIds.length>100)throw Error('Filiallarni tekshiring.');
 const startsAt=utc(form.startsAt),endsAt=utc(form.endsAt);
 if(startsAt>=endsAt)throw Error('Tugash vaqti boshlanishdan keyin bo‘lishi kerak.');
 const common={id,enabled:form.enabled===true,productId:form.productId,storeIds,startsAt,endsAt};
 if(form.kind==='BUY_GET')return {...common,kind:form.kind,buy:integer(form.buy,1000),free:integer(form.free,1000),maxGroups:integer(form.maxGroups,1000000)};
 if(form.kind==='QUANTITY_PERCENT'){
  const percent=Number(form.percent);
  if(!Number.isFinite(percent)||percent<=0||percent>100||Math.round(percent*100)/100!==percent)throw Error('Chegirma 0.01–100% oralig‘ida bo‘lishi kerak.');
  return {...common,kind:form.kind,minQuantity:integer(form.minQuantity,1000000),discountBps:Math.round(percent*100)};
 }
 throw Error('Aksiya turini tanlang.');
}
export function promotionRuleForm(rule={}){
 return {id:rule.id||'',productId:rule.productId||'',storeIds:rule.storeIds||[],kind:rule.kind||'BUY_GET',enabled:rule.enabled===true,startsAt:rule.startsAt?.slice(0,16)||'',endsAt:rule.endsAt?.slice(0,16)||'',buy:rule.buy??2,free:rule.free??1,maxGroups:rule.maxGroups??10,minQuantity:rule.minQuantity??3,percent:rule.discountBps!==undefined?rule.discountBps/100:10};
}
