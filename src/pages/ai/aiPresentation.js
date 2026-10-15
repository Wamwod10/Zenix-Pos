// Presentation only. The server remains authoritative for all access and writes.
export function aiFactValue(fact){
 if(fact.value===null)return 'Ma’lumot yetarli emas';
 const unit=typeof fact.unit==='string'?fact.unit:'';
 // Format exact server decimals as strings: large monetary values must not lose cents.
 const raw=String(fact.value??'');
 const parts=raw.split('.');
 const value=unit==='UZS'&&/^-?\d+(?:\.\d+)?$/.test(raw)?parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ')+(parts.length===2?'.'+parts[1]:''):raw;
 const suffix=unit==='UZS'?' so‘m':unit==='count'?' ta':['piece','pcs'].includes(unit)?' dona':unit&&!['text','datetime'].includes(unit)?' '+unit:'';
 return `${value}${suffix}`;
}
export function aiProgressLabel(phase){
 const labels={understanding:'Savol tushunilmoqda…',reading_sales:'Savdo ma’lumotlari o‘qilmoqda…',reading_inventory:'Ombor ma’lumotlari o‘qilmoqda…',preparing_action:'Amal taklifi tayyorlanmoqda…',composing:'Javob yozilmoqda…',verifying:'Javob tekshirilmoqda…',complete:'Javob tayyor',failed:'So‘rov bajarilmadi'};
 return Object.hasOwn(labels,phase)?labels[phase]:'Javob tayyorlanmoqda…';
}
export function aiMessageBlocks(message){
 if(!Array.isArray(message?.blocks))return [];
 return message.blocks.filter(block=>block&&['paragraph','facts','recommendation'].includes(block.type)).map(block=>({
  type:block.type,text:typeof block.text==='string'?block.text:'',
  facts:Array.isArray(block.facts)?block.facts.filter(f=>f&&typeof f.id==='string'&&typeof f.text==='string').map(f=>({id:f.id,text:f.text})):[],
 })).filter(block=>block.text||block.facts.length);
}
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

export function aiMessageReports(message){
 const reports=(message.toolResults||[]).filter(t=>t.result?.kind==='report'&&t.result.report).map(t=>t.result.report);
 return reports.length?reports:message.report?[message.report]:[];
}
export function aiErrorMessage(error){
 if(error?.details?.reason==='token_exhaustion')return 'AI javobi token chegarasida tugadi. Savolni qisqartiring yoki qismlarga bo‘ling.';
 const messages={
  AI_PROVIDER_FAILURE:'OpenAI vaqtincha javob bermadi. Birozdan keyin qayta urinib ko‘ring.',
  AI_INVALID_RESPONSE:'AI javob formati tekshiruvdan o‘tmadi. Javob ko‘rsatilmadi; qayta urinib ko‘ring.',
  AI_EVIDENCE_INVALID:'AI javobidagi biznes da’vosi tasdiqlanmadi. Tekshirilmagan raqamlar ko‘rsatilmadi.',
  AI_TOKEN_LIMIT:'Suhbat yoki so‘rov hajmi chegaraga yetdi. Savolni qismlarga bo‘ling yoki yangi suhbat boshlang.',
  AI_COST_LIMIT:'AI xarajat chegarasiga yetdi. So‘rovni qisqartiring yoki keyinroq qayta urinib ko‘ring.',
  AI_TIMEOUT:'AI javobini kutish vaqti tugadi. Shu savolni qayta yuborishingiz mumkin.',
  AI_TOOL_TIMEOUT:'Biznes ma’lumotlarini o‘qish vaqti tugadi. Ma’lumotlar taxmin qilinmadi; qayta urinib ko‘ring.',
  AI_TOOL_FAILURE:'Biznes ma’lumotlari xizmati vaqtincha ishlamayapti. Keyinroq qayta urinib ko‘ring.',
  AI_TOOL_LIMIT:'Bu savol uchun juda ko‘p tekshiruv kerak bo‘ldi. Uni kichikroq savollarga bo‘ling.',
  AI_QUOTA_EXCEEDED:'Oylik muvaffaqiyatli AI so‘rovlari limiti tugagan.',
  AI_FORBIDDEN:'Bu biznes ma’lumotlarini ko‘rish uchun ruxsatingiz yo‘q.',
  AI_CONVERSATION_EXPIRED:'Suhbat muddati tugagan. Quyidagi tugma orqali yangi suhbatda davom eting. Yozilgan matn va operatsiya kartalari saqlanadi; amallar avtomatik takrorlanmaydi.',
  AI_CONVERSATION_FORBIDDEN:'Suhbat sessiyasi, filial doirasi yoki ruxsatlar o‘zgargan. Yangi suhbat boshlang.',
 };
 return messages[error?.code]||error?.message||'AI javobini olib bo‘lmadi. Qayta urinib ko‘ring.';
}
