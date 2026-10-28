import { createRequestCoordinator } from "./requestCoordinator";

const RAW_API_URL=String(import.meta.env.VITE_API_URL||"").trim().replace(/\/$/,"");
export const API_URL=RAW_API_URL;

export class ApiError extends Error{
  constructor(message,{status=0,code="API_ERROR",details}={}){super(message);this.name="ApiError";this.status=status;this.code=code;this.details=details}
}

const FRIENDLY_ERRORS={
  CUSTOMER_FINANCIAL_WRITE_FORBIDDEN:'Mijozning kredit va loyalty sozlamalarini o‘zgartirishga ruxsat yo‘q.',
  CLIENT_REFERENCE_REQUIRED:'To‘lov identifikatori yetishmayapti. Sahifani yangilab, qayta urining.',
  SHIFT_CASH_CHANGED:'Kassa summasi o‘zgardi. Yangilangan hisobni tekshirib, qayta yoping.',
  AI_UNAVAILABLE:'ZENIX AI provayderi hali faollashtirilmagan. POS modullari ishlashda davom etadi.',
  AI_FAILURE:'AI tahlili vaqtincha mavjud emas. Birozdan keyin qayta urining.',
  AI_PROVIDER_FAILURE:'AI provayderi javob bermadi. POS modullari ishlashda davom etadi.',
  AI_TIMEOUT:'AI javobi belgilangan vaqtda kelmadi. Qayta urinib ko‘ring.',
  AI_QUOTA_EXCEEDED:'Oylik AI so‘rovlari tugagan. Limit yangilanishini kuting yoki tarifni oshiring.',
  AI_COST_LIMIT:'AI xarajat chegarasi tugagan. Keyinroq qayta urining; POS modullari ishlashda davom etadi.',
  AI_RATE_LIMIT:'AI so‘rovlari juda tez yuborildi. Biroz kuting.',
  AI_UNSAFE_QUESTION:'Ushbu savol xavfsiz biznes tahliliga tegishli emas. Tavsiya etilgan savolni tanlang.',
  AI_QUESTION_UNSUPPORTED:'Tavsiya etilgan biznes savollaridan birini tanlang.',
  AI_FORBIDDEN:'Bu biznes tahlili ma’lumotlariga ruxsat yo‘q.',
  AI_ACCESS_CHANGED:'Sessiya yoki ruxsatlar o‘zgargan. Sahifani yangilang.',
  AI_REQUEST_PENDING:'Oldingi so‘rov hali bajarilmoqda. Birozdan keyin ayni savolni qayta yuboring.',
  AI_REQUEST_FAILED:'Oldingi so‘rov muvaffaqiyatsiz tugagan. Yangi so‘rov yuboring.',
  AI_INVALID_RESPONSE:'AI javobi ma’lumotlarga mos kelmadi. So‘rov kvotadan yechilmadi.',
  AI_PLAN_REQUIRED:'ZENIX AI uchun Business yoki Premium tarifini tanlang.',
  SUBSCRIPTION_QUOTE_STALE:'Obuna hisobi eskirgan. To‘lov qilishdan oldin yangi server hisobini oling.',
  LEGACY_SUBSCRIPTION_REVIEW_REQUIRED:'Eski obunaning foydalanilmagan qiymatini administrator tekshirishi kerak. Administratorga murojaat qiling.',
  SCHEDULED_PLAN_CONFLICT:'Downgrade rejalangan. Keyingi davr uchun rejalangan tarifni tanlang yoki rejani bekor qiling.',
  FUNDED_DOWNGRADE_CONFLICT:'Kelajak tarifi uchun to‘lov tasdiqlangan. O‘zgartirish uchun administratorga murojaat qiling.',
  DOWNGRADE_REQUIRED:'Pastroq tarif uchun avval downgrade rejalashtiring.',
  TRIAL_NOT_ACTIVE:'Trial muddati tugagan. Tarifni to‘lov orqali faollashtiring.',
  REGISTER_INACTIVE:'Tanlangan POS kassa faol emas. Faol kassani tanlang yoki uni faollashtiring.',
  SHIFT_ALREADY_OPEN:'Bu filialda smena allaqachon ochiq. Holatni yangilab, joriy filialdagi ochiq smenani tekshiring.',
  EMPLOYEE_SHIFT_ALREADY_OPEN:'Boshqa filialdagi smenangiz ochiq. O‘sha filialga o‘tib, smenani yakunlang; keyin bu filialda qayta urining.',
  REGISTER_HAS_OPEN_SHIFT:'POS kassada ochiq smena bor. Kassani faolsizlantirishdan oldin smenani yoping.',
  TRIAL_ALREADY_USED:"Bu telefon raqami bilan bepul sinov avval ishlatilgan. Pullik tarifni tanlang yoki mavjud akkauntingizga kiring.",
  USERNAME_EXISTS:"Bu kirish nomi allaqachon band. Boshqa kirish nomi tanlang yoki mavjud akkauntingizga kiring.",
  PHONE_EXISTS:"Bu telefon raqami allaqachon mavjud. Boshqa telefon kiriting yoki mavjud akkauntingizga kiring.",
  REGISTRATION_RATE_LIMITED:"Ro‘yxatdan o‘tish urinishlari limiti tugadi. Birozdan keyin qayta urinib ko‘ring.",
  OTP_REQUIRED:"Bepul sinovni boshlash uchun telefon raqamingizni SMS kod orqali tasdiqlang.",
  OTP_UNAVAILABLE:"Telefon tasdiqlash xizmati hozir mavjud emas. Birozdan keyin qayta urinib ko‘ring.",
  SMS_UNAVAILABLE:"SMS xizmati hozir mavjud emas. Birozdan keyin qayta urinib ko‘ring.",
  HOLD_PRODUCT_UNAVAILABLE:"Savatda arxivlangan yoki topilmagan mahsulot bor. Joriy katalogni tekshiring.",
  IDEMPOTENCY_CONFLICT:"Bu savdo identifikatori boshqa ma’lumot bilan ishlatilgan. Oldingi amal natijasini tekshiring.",
  INVALID_CREDENTIALS:"Kirish nomi yoki parol noto‘g‘ri.",
  BILLING_DRAFT_STALE:"Tarif, filiallar soni yoki muddat o‘zgargan. Yangi to‘lov hisobini yarating.",
  BILLING_REVIEW_CONFLICT:"Boshqa to‘lov hali tekshiruvda. Avval uni yakunlang.",
  BILLING_RECEIPT_ALREADY_USED:"Bu chek boshqa to‘lovda ishlatilgan. Yangi chek yuklang.",
  LOGIN_RATE_LIMITED:"Juda ko‘p noto‘g‘ri urinish. Birozdan keyin qayta urinib ko‘ring.",
  CREDIT_LIMIT_EXCEEDED:"Mijozning kredit limiti yetarli emas. Qarz yoki kredit limitini tekshiring.",
  CREDIT_DUE_DATE_REQUIRED:"Nasiya uchun to‘lov muddatini kiriting.",
  CREDIT_DUE_DATE_PAST:"Nasiya muddati bugundan oldin bo‘lishi mumkin emas. Yangi muddat tanlang.",
  TRACKED_SERIAL_ADJUSTMENT_REQUIRED:"Serial/IMEI mahsulot qoldig‘ini umumiy son bilan o‘zgartirib bo‘lmaydi. Serial birliklarini aniq kiriting.",
  TRACKED_BATCH_ADJUSTMENT_REQUIRED:"Partiyali mahsulot qoldig‘ini umumiy son bilan o‘zgartirib bo‘lmaydi. Partiya miqdorlarini aniq kiriting.",
  INSUFFICIENT_STOCK:"Mahsulot qoldig‘i yetarli emas. Joriy filial qoldig‘ini yangilang.",
  INSUFFICIENT_AVAILABLE_STOCK:"Transfer uchun bo‘sh qoldiq yetarli emas.",
  INSUFFICIENT_REGISTER_CASH:"Kassada ushbu amal uchun yetarli naqd pul yo‘q.",
  SERIAL_QUANTITY_INVALID:"Serial/IMEI mahsulot miqdori butun son bo‘lishi kerak.",
  SERIAL_QUANTITY_MISMATCH:"Har bir dona uchun alohida serial/IMEI kiriting.",
  SERIAL_NOT_AVAILABLE:"Tanlangan serial/IMEI omborda mavjud emas.",
  DUPLICATE_SERIAL:"Serial/IMEI qiymatlari takrorlangan.",
  STORE_ENTITLEMENT_EXPIRED:"Ushbu filialning pullik muddati tugagan. Billing bo‘limida filial obunasini uzaytiring.",
  STORE_TRADING_HOLD:"Filialda savdo administrator tomonidan vaqtincha cheklangan. Administrator bilan bog‘laning.",
  STORE_INACTIVE:"Filial faol emas. Faol filialni tanlang.",
  SHIFT_REQUIRED:"Bu amal uchun avval joriy filialda smenani oching.",STORE_NAME_EXISTS:"Bu nomdagi filial allaqachon mavjud. Boshqa nom kiriting.",STORE_LIMIT:"Tarifingizdagi filial limiti tugagan. Tarif va to‘lovlar bo‘limidan limitni oshiring.",LAST_ACTIVE_STORE:"Oxirgi faol filialni arxivlab bo‘lmaydi.",CUSTOMER_PHONE_EXISTS:"Bu telefon raqami bilan mijoz allaqachon mavjud.",CUSTOMER_PAYMENT_EXCEEDS_BALANCE:"To‘lov summasi mijozning joriy qarzidan katta.",PAYMENT_EXCEEDS_DEBT:"To‘lov summasi ochiq ta’minotchi qarzidan katta.",SUPPLIER_HAS_DEBT:"Ta’minotchida ochiq qarz bor. Avval qarzni yoping.",PRODUCT_HAS_HISTORY:"Mahsulot tarixiy hujjatlarda ishlatilgan. Uni arxivlash mumkin, lekin butunlay o‘chirib bo‘lmaydi.",PRODUCT_HAS_STOCK:"Mahsulotda qoldiq mavjud. Qoldiqni qayerdaligini tekshirib, transfer/sotuv/inventarizatsiya orqali yakunlang.",PRODUCT_HAS_TRANSFER:"Mahsulot ochiq transferga biriktirilgan. Avval transferni qabul qiling yoki bekor qiling, keyin qayta urinib ko‘ring.",INVENTORY_COUNT_CONFLICT:"Sanash vaqtida qoldiq o‘zgargan. Yangilangan qoldiqni tekshirib, mahsulotlarni qayta sanang.",STORE_HAS_DEPENDENCIES:"Filialda yakunlanmagan operatsiyalar bor. Ko‘rsatilgan smena, qoldiq, xodim, transfer yoki inventarizatsiyani yakunlang."
};
const friendlyStatusMessage=(status)=>{
  if(status===400)return "Kiritilgan ma’lumotlarni tekshirib, qayta urinib ko‘ring.";
  if(status===401)return "Sessiya yakunlangan. Qayta kiring.";
  if(status===403)return "Bu amal uchun sizda yetarli ruxsat yo‘q.";
  if(status===404)return "So‘ralgan ma’lumot topilmadi yoki endi mavjud emas.";
  if(status===409)return "Amalni yakunlab bo‘lmadi. Ma’lumotlarni yangilab, qayta urinib ko‘ring.";
  if(status===413)return "Yuborilgan fayl yoki ma’lumot hajmi juda katta.";
  if(status===429)return "Juda ko‘p so‘rov yuborildi. Birozdan keyin qayta urinib ko‘ring.";
  if(status>=500)return "Serverda vaqtinchalik xatolik yuz berdi. Qayta urinib ko‘ring.";
  return "Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.";
};
const friendlyError=(error,status)=>{
  const names={EMPLOYEE_LIMIT:'Faol xodimlar',STORE_LIMIT:'Filiallar',WAREHOUSE_LIMIT:'Omborlar',REGISTER_LIMIT:'Faol kassalar',PRODUCT_LIMIT:'Mahsulotlar',CUSTOMER_LIMIT:'Mijozlar'};
  const detail=error?.details;
  if(names[error?.code]&&Number.isFinite(detail?.used)&&Number.isFinite(detail?.limit))return `${names[error.code]} limiti tugagan: ${detail.used}/${detail.limit}. ${detail.upgradeAvailable?'Tarifni oshirish uchun Billing bo‘limiga o‘ting.':'Yangi resurs yaratishdan oldin foydalanishni kamaytiring.'}`;
  if(status===402)return 'Faqat ko‘rish rejimi. Trial yoki obuna tugagan, yoxud billing cheklovi bor. Obunani faollashtirish uchun Billing bo‘limiga o‘ting.';
  return FRIENDLY_ERRORS[error?.code]||friendlyStatusMessage(status);
};
// Compatibility with older servers: only these exact, known duplicate messages
// become field errors. Arbitrary server messages never reach the UI.
const normalizeError=error=>error?.code!=="DUPLICATE"?error:{...error,code:{
  "Bu kirish nomi allaqachon mavjud":"USERNAME_EXISTS",
  "Bu telefon raqami boshqa faol xodimga biriktirilgan":"PHONE_EXISTS",
}[error.message]||error.code};

const ensureApi=()=>true;
const requestCoordinator=createRequestCoordinator();
const getKey=(path,headers={})=>`${path}::${JSON.stringify(headers||{})}`;
const parseError=async(response)=>{
  const payload=await response.clone().json().catch(()=>null);
  const error=normalizeError(payload?.error||{});
  return new ApiError(friendlyError(error,response.status),{status:response.status,code:error.code||"API_ERROR",details:error.details});
};

export async function apiRequest(path,{method="GET",body,headers={},signal}={}){
  ensureApi();
  const response=await fetch(`${API_URL}${path}`,{
    method,credentials:"include",signal,
    headers:{"X-Zenix-Client":"web",...(body===undefined?{}:{"Content-Type":"application/json"}),...headers},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false){const error=normalizeError(payload?.error||{});throw new ApiError(friendlyError(error,response.status),{status:response.status,code:error.code||"API_ERROR",details:error.details})}
  return payload?.data??payload;
}

export async function apiUpload(path,file,{signal,headers={},purpose}={}){
  ensureApi();
  if(!file)throw new ApiError("Fayl tanlanmagan",{code:"FILE_REQUIRED"});
  const response=await fetch(`${API_URL}${path}`,{
    method:"POST",credentials:"include",signal,
    headers:{"X-Zenix-Client":"web","Content-Type":file.type||"application/octet-stream","X-File-Name":encodeURIComponent(file.name||"file"),...(purpose?{"X-File-Purpose":purpose}:{}),...headers},
    body:file,
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false){const error=payload?.error||{};throw new ApiError(friendlyError(error,response.status),{status:response.status,code:error.code||"API_ERROR",details:error.details})}
  return payload?.data??payload;
}

export async function apiBlob(path,{signal}={}){
  ensureApi();
  const response=await fetch(`${API_URL}${path}`,{method:"GET",credentials:"include",signal});
  if(!response.ok)throw await parseError(response);
  return response.blob();
}

export const api={
  get:(path,options={})=>{
    if(options?.signal)return apiRequest(path,{...options,method:"GET"});
    const key=getKey(path,options?.headers);
    return requestCoordinator.get(key,()=>apiRequest(path,{...options,method:"GET"}));
  },
  post:(path,body,options={})=>requestCoordinator.mutate(()=>apiRequest(path,{...options,method:"POST",body})),
  patch:(path,body,options={})=>requestCoordinator.mutate(()=>apiRequest(path,{...options,method:"PATCH",body})),
  delete:(path,options={})=>requestCoordinator.mutate(()=>apiRequest(path,{...options,method:"DELETE"})),
  upload:apiUpload,
  blob:apiBlob,
};
