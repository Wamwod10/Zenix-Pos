import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiArchive, FiBookOpen, FiBriefcase, FiCreditCard, FiHelpCircle, FiPackage,
  FiSearch, FiSettings, FiShoppingCart, FiTruck, FiUsers, FiCheckCircle, FiCircle,
} from "react-icons/fi";
import { PageHeader } from "../../components/Ui";
import { useStore } from "../../context/StoreContext";
import "./helpCenter.scss";

const guides = [
  { id:"start", icon:FiBookOpen, title:"Ishni boshlash", description:"Filial, xodim, mahsulot va kassani birinchi marta tayyorlash.", route:"/settings", tags:"boshlash onboarding sozlash", steps:["Tashkilot va filial ma’lumotlarini tekshiring.","Xodimlar va ularning rollarini belgilang.","Ombor orqali birinchi tovar kirimini qiling.","Kassa smenasini ochib test savdosini bajaring."] },
  { id:"sale", icon:FiShoppingCart, title:"Savdo qilish", description:"Shtrix-kod, savat, chegirma, aralash to‘lov va chek.", route:"/sales", tags:"pos savdo barcode karta naqd split", steps:["Kassa / Smena bo‘limida smenani oching.","Shtrix-kodni skaner qiling yoki mahsulotni qidiring.","Miqdor va kerak bo‘lsa chegirmani belgilang.","Naqd, karta, o‘tkazma yoki aralash to‘lovni tanlang.","Savdoni yakunlang va chekni bering."] },
  { id:"receive", icon:FiArchive, title:"Omborga kirim", description:"Yangi yoki mavjud mahsulotni omborga to‘g‘ri qabul qilish.", route:"/inventory", tags:"ombor kirim qabul tovar", steps:["Ombor → Kirim bo‘limini oching.","Shtrix-kod orqali mavjud mahsulotni toping; topilmasa shu yerda yangi mahsulot yarating.","Miqdor, tannarx, sotuv narxi va ta’minotchini kiriting.","To‘landi yoki qarzga holatini belgilang.","Kirimni tasdiqlang — mahsulot POS’da darhol sotuvga tayyor bo‘ladi."] },
  { id:"quick-receive", icon:FiPackage, title:"Tezkor kirim", description:"Bir nechta mahsulotni bitta kirimda qabul qilish.", route:"/inventory", tags:"tezkor bulk ko‘p mahsulot", steps:["Ombor → Tezkor kirimni oching.","Mahsulotlarni qatorlarga qo‘shing yoki Hujjatdan import orqali ma’lumotni tayyorlang.","Har qator uchun miqdor, tannarx va sotuv narxini tekshiring.","Umumiy ta’minotchi, to‘langan summa va qarzni tekshiring.","Barcha qatorlarni bir martada tasdiqlang."] },
  { id:"products", icon:FiPackage, title:"Mahsulotlar katalogi", description:"Shtrix-kod, narx va katalog ma’lumotlarini boshqarish.", route:"/products", tags:"mahsulot katalog sku narx barcode", steps:["Mahsulotlar bo‘limidan kerakli mahsulotni qidiring.","Ruxsat bo‘lsa nom, shtrix-kod, kategoriya va sotuv narxini tahrirlang.","Qoldiqni to‘g‘ridan-to‘g‘ri bu yerda emas, Ombor orqali o‘zgartiring."] },
  { id:"document-import", icon:FiArchive, title:"Hujjatdan import", description:"PDF, jadval yoki matnli hujjatdan kirim ma’lumotlarini tayyorlash.", route:"/inventory", tags:"pdf excel csv xlsx import hujjat nakladnoy", steps:["Ombor → Hujjatdan importni oching.","PDF, Excel, CSV, matn yoki boshqa qo‘llab-quvvatlanadigan hujjatni yuklang.","Zenix POS topgan mahsulot, miqdor, tannarx, ta’minotchi va qarz ma’lumotlarini ko‘rib chiqish oynasida tekshiring.","Noaniq qatorlarni tuzating — tizim taxminiy qiymatni yashirincha qoldiqqa yozmaydi.","Tekshiruv tugagach Kirimni tasdiqlang."] },
  { id:"return", icon:FiShoppingCart, title:"Savdoni qaytarish", description:"To‘liq yoki qisman qaytarish va pulni qaytarish usulini boshqarish.", route:"/history", tags:"qaytarish refund return savdo tarix", steps:["Savdo tarixi yoki bugungi savdolardan kerakli chekni oching.","Qaytariladigan mahsulot va miqdorni tanlang.","Sabab va qaytarish usulini belgilang.","Naqd pul chiqimi kerak bo‘lsa smena ochiq ekanini tekshiring.","Tasdiqlang — qoldiq, qaytarish tarixi va kassa hisobi avtomatik yangilanadi."] },
  { id:"transfer", icon:FiTruck, title:"Filiallararo transfer", description:"Mahsulotni bir filialdan boshqasiga xavfsiz ko‘chirish.", route:"/inventory", tags:"transfer filial ombor tasdiqlash", steps:["Ombor → Transferlar bo‘limini oching.","Qabul qiluvchi filial, mahsulot va miqdorni tanlang.","Tasdiqlash qoidasi yoqilgan bo‘lsa Egasi yoki Administrator transferni tasdiqlaydi.","Mahsulot yo‘lga chiqqach qabul qiluvchi filial Qabul qilishni bosadi."] },
  { id:"count", icon:FiArchive, title:"Inventarizatsiya", description:"Real qoldiqni sanash va tizimdagi qoldiq bilan solishtirish.", route:"/inventory", tags:"inventarizatsiya sanash qoldiq revision", steps:["Ombor → Inventarizatsiya bo‘limini oching.","Har mahsulot uchun real sanalgan qoldiqni kiriting.","Farqlarni tekshiring.","Tasdiqlash qoidasi yoqilgan bo‘lsa natijani tasdiqlashga yuboring; aks holda qoldiq darhol yangilanadi."] },
  { id:"supplier", icon:FiTruck, title:"Ta’minotchi va qarz", description:"Kirimlar, ochiq qarz va to‘lov tarixini kuzatish.", route:"/suppliers", tags:"ta’minotchi qarz nakladnoy", steps:["Ta’minotchini yarating yoki Kirim ichidan yangi ta’minotchi qo‘shing.","Qarzga kirimda summa va muddatni kiriting.","Ta’minotchiga to‘lov qilganda qarz tarixi yangilanadi."] },
  { id:"shift", icon:FiBriefcase, title:"Kassa / Smena", description:"Smenani ochish, kassa kirim-chiqimi va yopish.", route:"/shifts", tags:"smena kassa haqiqiy naqd", steps:["Boshlang‘ich naqd summani kiriting va smenani oching.","Kun davomida kassa kirimi/chiqimini sabab bilan yozing.","Smena oxirida haqiqiy naqdni sanang.","Tizim kutilayotgan summa bilan farqni ko‘rsatadi."] },
  { id:"employees", icon:FiUsers, title:"Xodimlar va ruxsatlar", description:"Kim qaysi modul va amalni ishlata olishini boshqarish.", route:"/settings", tags:"xodim rol ruxsat", steps:["Sozlamalar → Xodimlar bo‘limini oching.","Xodim roli va filialini tanlang.","Kerakli amallar uchun ruxsatlarni belgilang.","Kirish hisobini xodim profiliga bog‘lang."] },
  { id:"billing", icon:FiCreditCard, title:"Tarif va to‘lovlar", description:"Tarif, filial limiti va to‘lov holatini tushunish.", route:"/billing", tags:"tarif to‘lov litsenziya", steps:["Joriy tarif va tugash sanasini tekshiring.","Tarifni uzaytirishda qaysi sanagacha davom etishini tanlang — Zenix POS summani avtomatik hisoblaydi.","Keyingi davr uchun filial limitini tekshiring.","To‘lovni amalga oshirib chekni yuklang.","Tasdiqlangach yangi xizmat davri avtomatik faollashadi."] },
  { id:"expenses", icon:FiCreditCard, title:"Xarajat va kassa chiqimi", description:"Operatsion xarajatni yozish va naqd kassaga bog‘lash.", route:"/expenses", tags:"xarajat kassa chiqim chek", steps:["Xarajatlar → Xarajat qo‘shish tugmasini bosing.","Kategoriya, summa, sana va to‘lov turini kiriting.","Naqd to‘lov faol smenaga bog‘lansa kassa chiqimi avtomatik yoziladi.","Kerak bo‘lsa chek yoki hujjatni biriktiring."] },
  { id:"analytics", icon:FiBookOpen, title:"Analitika va hisobotlar", description:"Sof savdo, foyda, qaytarish va to‘lov taqsimotini tahlil qilish.", route:"/analytics", tags:"analitika hisobot foyda savdo dashboard", steps:["Davr va filialni tanlang.","Sof savdo va foyda KPI’larini ko‘ring.","Mahsulot, kategoriya va to‘lov kesimlarini tahlil qiling.","Kerak bo‘lsa CSV eksportdan foydalaning."] },
  { id:"telegram", icon:FiHelpCircle, title:"Telegram guruhini ulash", description:"@zenixposbot guruhini Zenix POS bildirishnomalariga ulash.", route:"/settings", tags:"telegram bot guruh ulash", steps:["Sozlamalar → Telegram bo‘limini oching.","Guruhni ulash tugmasini bosing.","Telegram ochilganda kerakli ishchi guruhni tanlang va botni qo‘shing.","Bot guruhda ulanish muvaffaqiyatli bo‘lganini tasdiqlaydi.","Zenix POS’da kerakli bildirishnomalarni yoqing yoki o‘chiring."] },
  { id:"settings", icon:FiSettings, title:"Sozlamalar", description:"POS, chek, ombor, interfeys va integratsiyalar.", route:"/settings", tags:"sozlamalar telegram chek interfeys", steps:["Kerakli sozlama guruhini tanlang.","Asosiy sozlamalar darhol saqlanadi.","Texnik ko‘rinish parametrlari Kengaytirilgan bo‘limida joylashadi."] },
];

function HelpCenter(){
  const navigate=useNavigate();
  const location=useLocation();
  const {stores,employees,stockMovements,dailySales,salesHistory,telegramSettings,workspaceSettings}=useStore();
  const params=new URLSearchParams(location.search);
  const fromRoute=params.get("from")||"";
  const contextual=guides.find((guide)=>fromRoute&&guide.route===fromRoute);
  const [search,setSearch]=useState("");
  const [active,setActive]=useState(contextual?.id||"start");
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return q?guides.filter(g=>`${g.title} ${g.description} ${g.tags} ${g.steps.join(" ")}`.toLowerCase().includes(q)):guides},[search]);
  const selected=guides.find(g=>g.id===active)||filtered[0]||guides[0];
  const SelectedIcon=selected.icon;
  const anyTelegram=Object.values(telegramSettings?.connections||{}).some((item)=>item?.connected)||telegramSettings?.connected;
  const onboarding=[
    {id:"store",label:"Filialni tayyorlash",done:stores.some((item)=>item.active!==false),path:"/settings"},
    {id:"employee",label:"Xodim qo‘shish",done:employees.length>1,path:"/settings"},
    {id:"receive",label:"Birinchi kirim",done:(stockMovements||[]).some((item)=>item.type==="receive"||item.type==="adjust"),path:"/inventory?receive=1"},
    {id:"sale",label:"Birinchi savdo",done:(dailySales?.length||0)>0||(salesHistory?.length||0)>0,path:"/sales"},
    {id:"receipt",label:"Chek sozlamasini tekshirish",done:Boolean(workspaceSettings?.receipt?.width&&workspaceSettings?.receipt?.footer),path:"/settings"},
    {id:"telegram",label:"Telegram guruhini ulash",done:Boolean(anyTelegram),path:"/settings"},
  ];
  const onboardingDone=onboarding.filter((item)=>item.done).length;
  const showGuide=()=>navigate(`${selected.route}${selected.route.includes("?")?"&":"?"}guide=${encodeURIComponent(selected.id)}`);
  return <div className="pro-page help-center-page">
    <PageHeader title="Yordam Markazi" subtitle="Platformani bosqichma-bosqich o‘rganing va kerakli bo‘limga tez o‘ting."/>
    <section className="help-hero pro-card"><div><span className="help-hero-icon"><FiHelpCircle/></span><div><h2>Nimani qilishni o‘rganmoqchisiz?</h2><p>Savdo, ombor, xodimlar yoki sozlamalar bo‘yicha yo‘riqnomani qidiring.</p></div></div><label className="help-search"><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Masalan: omborga kirim, qaytarish, aralash to‘lov..."/></label></section>
    <section className="help-onboarding pro-card"><div className="help-onboarding-head"><span><strong>Ishga tushirish ro‘yxati</strong><small>{onboardingDone} / {onboarding.length} tayyor</small></span><div><i style={{width:`${Math.round(onboardingDone/onboarding.length*100)}%`}}/></div></div><div className="help-onboarding-list">{onboarding.map((item)=>{const Icon=item.done?FiCheckCircle:FiCircle;return <button type="button" key={item.id} className={item.done?"done":""} onClick={()=>navigate(item.path)}><Icon/><span>{item.label}</span></button>})}</div></section>
    <div className="help-layout">
      <aside className="help-nav pro-card">{filtered.length?filtered.map(g=>{const Icon=g.icon;return <button key={g.id} className={selected.id===g.id?"active":""} onClick={()=>setActive(g.id)}><span><Icon/></span><div><strong>{g.title}</strong><small>{g.description}</small></div></button>}):<div className="help-empty">Yo‘riqnoma topilmadi.</div>}</aside>
      <section className="help-guide pro-card"><div className="help-guide-head"><span><SelectedIcon/></span><div><h2>{selected.title}</h2><p>{selected.description}</p></div><div className="help-guide-actions"><button className="pro-btn secondary" onClick={()=>navigate(selected.route)}>Bo‘limga o‘tish</button><button className="pro-btn primary" onClick={showGuide}>Menga ko‘rsat</button></div></div><div className="help-steps">{selected.steps.map((step,index)=><div key={step}><b>{index+1}</b><span><strong>{index+1}-qadam</strong><p>{step}</p></span></div>)}</div><div className="help-tip"><FiBookOpen/><span><strong>Maslahat</strong><p>Har bir amalni bajarishda kerakli tugmalar ruxsatlar va biznes sozlamalariga qarab ko‘rinadi.</p></span></div></section>
    </div>
  </div>;
}
export default HelpCenter;
