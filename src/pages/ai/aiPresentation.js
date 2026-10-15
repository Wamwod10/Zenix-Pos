// Presentation only. The server remains authoritative for all access and writes.
export function aiState(status,busy=false,error=''){
 if(status?.enabled===false)return {key:'off',label:'AI o‘chirilgan',message:'ZENIX AI hozircha faollashtirilmagan.'};
 if(!status)return error?{key:'error',label:'Vaqtincha mavjud emas',message:'AI holatini olib bo‘lmadi. Qayta urinib ko‘ring.'}:{key:'loading',label:'Holat tekshirilmoqda',message:''};
 if(!status.limit)return {key:'plan',label:'Tarif talab qilinadi',message:'ZENIX AI Business va Premium tariflarida mavjud.'};
 if(!status.writable)return {key:'expired',label:'Obuna muddati tugagan',message:'Obuna muddati tugagan. Ma’lumotlaringiz saqlangan; AI uchun tarifni faollashtirish kerak.'};
 if(status.remaining<=0)return {key:'quota',label:'Oylik limit tugagan',message:'Oylik AI so‘rovlari tugagan. POS modullari ishlashda davom etadi.'};
 if(busy)return {key:'busy',label:'Javob tayyorlanmoqda',message:''};
 if(error)return {key:'error',label:'Vaqtincha mavjud emas',message:''};
 return {key:'ready',label:'AI tayyor',message:''};
}
export function aiSuggestions(status,can){
 if(!status)return [];
 const topics=new Set(status.suggestions?.map(s=>s.topic));
 return [
  topics.has('today_sales')&&{id:'sales',title:'Savdolarni tahlil qilish',question:'Bugungi savdo natijalarini tahlil qil.'},
  (topics.has('low_stock')||can('moduleInventory'))&&{id:'stock',title:'Ombor qoldiqlari',question:'Qaysi mahsulotlar omborda kamaymoqda?'},
  topics.has('profit')&&{id:'profit',title:'Foydani oshirish',question:'Biznesimning foydasini qanday oshirsam bo‘ladi?'},
  status.writesEnabled&&can('moduleInventory')&&can('inventoryAdjust')&&{id:'receipt',title:'Ombor amallari',question:'Omborga mahsulot kirimi tayyorlashga yordam ber.'},
 ].filter(Boolean);
}
export const shouldFollowChat=({scrollHeight,scrollTop,clientHeight})=>scrollHeight-scrollTop-clientHeight<96;
