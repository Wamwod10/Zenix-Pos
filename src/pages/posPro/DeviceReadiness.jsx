import {useState} from 'react';

const manualChecks=[
  {id:'scanner',name:'Fizik barcode scanner',hint:'Barcode maydonida real USB/HID skaner orqali ma’lum mahsulotni o‘qing. Mahsulot qo‘shilganini va miqdorni tekshiring. Bu brauzer ulanish holatini avtomatik aniqlamaydi.'},
  {id:'printer',name:'58/80 mm chek printeri',hint:'Faqat test yoki oldindan mavjud chekni F10 orqali chop eting. Printer, qog‘oz eni va matn kesilmasligini fizik qurilmada tekshiring.'},
  {id:'touch',name:'Touch boshqaruvi',hint:'Touch rejimida mahsulotni tanlang, miqdorni o‘zgartiring va ekranda gorizontal overflow yo‘qligini tekshiring.'},
  {id:'offline',name:'Internet uzilishi',hint:'To‘lov boshlashdan oldin internetni uzib ko‘ring: savdo serverga yuborilmasin, draft saqlansin. Internet tiklangach noma’lum savdo natijasi avval tekshirilsin.'},
];

export default function DeviceReadiness({online,capabilities}){
  const [verified,setVerified]=useState({});
  const checkedCount=manualChecks.filter(({id})=>verified[id]===true).length;
  return <section className="pp-device-checklist" aria-labelledby="pp-device-checklist-title" style={{display:"grid",gap:12,minWidth:0,paddingTop:12,borderTop:"1px solid var(--border, rgba(128,128,128,.25))"}}>
    <h3 id="pp-device-checklist-title">Real qurilma tekshiruvi</h3>
    <p role="status">Qo‘lda tekshirildi: {checkedCount}/{manualChecks.length}. Bu faqat joriy oynadagi operator belgilaridir — avtomatik qurilma diagnostikasi yoki production sertifikati emas.</p>
    <p>Internet: {online?'brauzer online':'brauzer offline'}. WebUSB: {capabilities.usbAPI?'API mavjud':'API mavjud emas'}. Web Serial: {capabilities.serialAPI?'API mavjud':'API mavjud emas'}. API mavjudligi qurilma ulanganini tasdiqlamaydi.</p>
    <div className="pp-device-checklist-items" style={{display:"grid",gap:8}}>
      {manualChecks.map(item=><label key={item.id} className="pp-device-checklist-item" style={{display:"flex",alignItems:"flex-start",gap:10,padding:10,border:"1px solid var(--border, rgba(128,128,128,.25))",borderRadius:10,minWidth:0,cursor:"pointer"}}>
        <input type="checkbox" style={{flexShrink:0,marginTop:4}} checked={verified[item.id]===true} onChange={event=>setVerified(previous=>({...previous,[item.id]:event.target.checked}))}/>
        <span style={{display:"grid",gap:3,minWidth:0}}><strong>{item.name}</strong><small style={{lineHeight:1.5,opacity:.82,overflowWrap:"anywhere"}}>{item.hint}</small></span>
      </label>)}
    </div>
    <p><strong>Hozir qo‘llab-quvvatlanmaydi:</strong> ESC/POS bridge, cash drawer adapteri va fiskal provider. Bu funksiyalar checklist bilan faollashmaydi; integratsiya va haqiqiy qurilma acceptance’i kerak.</p>
    <button type="button" className="pro-btn secondary" disabled={checkedCount===0} onClick={()=>setVerified({})}>Tekshiruv belgilarini tozalash</button>
  </section>;
}
