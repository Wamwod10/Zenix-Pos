import {useState} from 'react';
import {DEVICE_ACCEPTANCE_CASES,buildDeviceAcceptanceReport} from './deviceAcceptanceReport';

const statuses=[
  {value:'not_tested',label:'Tekshirilmagan'},
  {value:'pass',label:'O‘tdi — operator tasdiqladi'},
  {value:'fail',label:'Xato topildi'},
  {value:'blocked',label:'Bloklangan'},
];
const fieldStyle={boxSizing:'border-box',width:'100%',minWidth:0,minHeight:38,padding:'8px 10px',borderRadius:8,border:'1px solid var(--border, rgba(128,128,128,.35))',background:'var(--surface, transparent)',color:'inherit'};

export default function DeviceReadiness({online,capabilities}){
  const [testTenant,setTestTenant]=useState('');
  const [operator,setOperator]=useState('');
  const [results,setResults]=useState({});
  const [exportError,setExportError]=useState('');
  const [exportMessage,setExportMessage]=useState('');
  const update=(id,field,value)=>{
    setResults(previous=>({...previous,[id]:{...previous[id],[field]:value}}));
    setExportError('');
    setExportMessage('');
  };
  const counts=DEVICE_ACCEPTANCE_CASES.reduce((acc,item)=>{
    const status=results[item.id]?.status||'not_tested';
    if(status==='pass')acc.pass++;
    else if(status==='fail')acc.fail++;
    else if(status==='blocked')acc.blocked++;
    return acc;
  },{pass:0,fail:0,blocked:0});
  const exportEvidence=()=>{
    let objectUrl;
    try{
      const report=buildDeviceAcceptanceReport({
        testTenant,operator,results,
        online,
        usbApiAvailable:capabilities.usbAPI,
        serialApiAvailable:capabilities.serialAPI,
        browserInfo:navigator.userAgent,
      });
      const file=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json;charset=utf-8'});
      objectUrl=URL.createObjectURL(file);
      const link=document.createElement('a');
      link.href=objectUrl;
      link.download='zenix-pos-device-acceptance-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
      document.body.append(link);
      try{link.click()}finally{link.remove()}
      // Delayed revoke allows the browser to finish the local download.
      const exportedUrl=objectUrl;
      setTimeout(()=>URL.revokeObjectURL(exportedUrl),10000);
      objectUrl=null;
      setExportError('');
      setExportMessage('Hisobotni yuklab olish brauzerga topshirildi. Reviewer dalillarni alohida tekshirishi shart.');
    }catch(error){
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      setExportMessage('');
      setExportError(error?.message||'Hisobotni tayyorlab bo‘lmadi');
    }
  };
  const reset=()=>{
    setResults({});
    setTestTenant('');
    setOperator('');
    setExportError('');
    setExportMessage('');
  };
  return <section className="pp-device-checklist" aria-labelledby="pp-device-checklist-title" style={{display:'grid',gap:12,minWidth:0,paddingTop:12,borderTop:'1px solid var(--border, rgba(128,128,128,.25))'}}>
    <h3 id="pp-device-checklist-title">Real qurilma tekshiruvi</h3>
    <p role="status">Operator belgilagan: {counts.pass} o‘tdi, {counts.fail} xato, {counts.blocked} bloklangan — jami {DEVICE_ACCEPTANCE_CASES.length} ta ssenariy. Hech biri avtomatik tasdiqlanmaydi.</p>
    <p>Internet: {online?'brauzer online':'brauzer offline'}. WebUSB: {capabilities.usbAPI?'API mavjud':'API mavjud emas'}. Web Serial: {capabilities.serialAPI?'API mavjud':'API mavjud emas'}. API mavjudligi fizik qurilma ulanganini bildirmaydi.</p>
    <p>Sinovni faqat ajratilgan test biznesda o‘tkazing. Chek ma’lumotlari, telefon raqamlari, haqiqiy mijozlar, parollar va tokenlarni dalil maydonlariga kiritmang. Natijalar serverga yuborilmaydi va ushbu oynada vaqtincha saqlanadi.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,200px),1fr))',gap:10}}>
      <label style={{display:'grid',gap:4,minWidth:0}}>
        <span>Sinov biznesi/filiali (majburiy)</span>
        <input aria-label="Sinov biznesi yoki filiali" value={testTenant} maxLength={120} onChange={event=>{setTestTenant(event.target.value);setExportError('')}} placeholder="Masalan, maxsus test filial" style={fieldStyle}/>
      </label>
      <label style={{display:'grid',gap:4,minWidth:0}}>
        <span>Operator belgisi (ixtiyoriy)</span>
        <input aria-label="Sinov operatori belgisi" value={operator} maxLength={80} onChange={event=>setOperator(event.target.value)} placeholder="Masalan, QA-1" style={fieldStyle}/>
      </label>
    </div>
    <div className="pp-device-checklist-items" style={{display:'grid',gap:10}}>
      {DEVICE_ACCEPTANCE_CASES.map(item=><div key={item.id} className="pp-device-checklist-item" style={{display:'grid',gap:8,padding:12,border:'1px solid var(--border, rgba(128,128,128,.25))',borderRadius:10,minWidth:0}}>
        <strong>{item.name}</strong>
        <small style={{lineHeight:1.5,opacity:.82,overflowWrap:'anywhere'}}>{item.hint}</small>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))',gap:8}}>
          <label style={{display:'grid',gap:3,minWidth:0}}>
            <span>Sinov natijasi</span>
            <select aria-label={item.name+' natijasi'} style={fieldStyle} value={results[item.id]?.status||'not_tested'} onChange={event=>update(item.id,'status',event.target.value)}>
              {statuses.map(status=><option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>
          <label style={{display:'grid',gap:3,minWidth:0}}>
            <span>Qurilma modeli / OS</span>
            <input aria-label={item.name+' qurilma modeli'} style={fieldStyle} maxLength={100} value={results[item.id]?.device||''} onChange={event=>update(item.id,'device',event.target.value)} placeholder="Model yoki brauzer"/>
          </label>
        </div>
        <label style={{display:'grid',gap:3,minWidth:0}}>
          <span>Dalil havolasi yoki test yozuvi (o‘tdi uchun majburiy)</span>
          <input aria-label={item.name+' dalili'} style={fieldStyle} maxLength={350} value={results[item.id]?.evidence||''} onChange={event=>update(item.id,'evidence',event.target.value)} placeholder="Test kodi, rasm/chek fayl nomi"/>
        </label>
        <label style={{display:'grid',gap:3,minWidth:0}}>
          <span>Izoh / aniqlangan xato</span>
          <textarea aria-label={item.name+' izohi'} style={{...fieldStyle,minHeight:56,resize:'vertical'}} rows={2} maxLength={500} value={results[item.id]?.notes||''} onChange={event=>update(item.id,'notes',event.target.value)} placeholder="Qanday sinov va natija?"/>
        </label>
      </div>)}
    </div>
    <p><strong>Hozir qo‘llab-quvvatlanmaydi:</strong> ESC/POS bridge, kassa tortmasi adapteri va fiskal provider. Bu funksiyalarni checklist orqali «o‘tdi» qilib bo‘lmaydi; alohida integratsiya va fizik acceptance talab qilinadi.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
      <button type="button" className="pro-btn primary" onClick={exportEvidence}>Dalil hisobotini JSON sifatida saqlash</button>
      <button type="button" className="pro-btn secondary" onClick={reset}>Sinov belgilarini tozalash</button>
    </div>
    {exportError&&<p role="alert" className="pp-error">{exportError}</p>}
    {exportMessage&&<p role="status">{exportMessage}</p>}
    <small>Hisobot «NOT_CERTIFIED» holatida yaratiladi. PASS operator tomonidan qo‘lda kiritilgan ma’lumot, mustaqil qurilma tasdig‘i emas. Olingan faylni reviewer tekshirishi kerak.</small>
  </section>;
}
