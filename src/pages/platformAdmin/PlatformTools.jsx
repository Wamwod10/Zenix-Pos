import {useState,useEffect,useRef} from 'react';
import {api} from '../../services/apiClient';
import {formatPrice} from '../../utils/formatPrice';
import {StatCard} from '../../components/Ui';
import {FiShield,FiCreditCard,FiUsers,FiClock,FiLock,FiAlertTriangle} from 'react-icons/fi';

export function PlatformSummary({overview,showMetrics=true}){
  if(!overview)return <div className="pro-empty">Statistika yuklanmoqda...</div>;
  return <>{overview.trialVerification?.configuredMode==='temporary_disabled'&&<div className="pro-alert" role="alert">SMSsiz trial rejimi: telefon egaligi tasdiqlanmaydi. Tugash sanasi: {overview.trialVerification.temporaryUntil}. {overview.trialVerification.temporaryExpired?'Muddat tugagan; SMS tasdiqlash majburiy.':'Muddat tugaganda SMS tasdiqlash majburiy bo\'ladi.'}</div>}{showMetrics&&<><div className="pro-stat-grid">{[['trial','Sinovdagi bizneslar'],['suspended','Bloklangan bizneslar'],['paymentBlocked','To‘lovgacha bloklangan'],['expired','Tugagan obunalar']].map(([key,label])=><StatCard key={key} icon={{trial:FiClock,suspended:FiLock,paymentBlocked:FiCreditCard,expired:FiAlertTriangle}[key]} label={label} value={overview[key]??'—'} tone={{trial:"blue",suspended:"red",paymentBlocked:"orange",expired:"purple"}[key]}/>)}</div><div className="pro-stat-grid"><StatCard icon={FiCreditCard} label="Tasdiqlangan to‘lovlar daromadi" value={formatPrice(overview.revenue||0,'UZS')} hint="Barcha davr; tasdiqlangan to‘lovlar"/><StatCard icon={FiUsers} label="Bizneslar obunalari" value={<span className="platform-plan-breakdown"><span><small>Oylik</small><b>{overview.plans?.MONTHLY??"—"}</b></span><span><small>Yillik</small><b>{overview.plans?.ANNUAL??"—"}</b></span></span>}/><StatCard icon={FiCreditCard} label="Tasdiqlangan obuna to‘lovlari" value={overview.subscriptions??'—'}/></div></>}</>;
}

export function PlatformAudit(){
  const [q,setQ]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0),[retryKey,setRetryKey]=useState(0),[logs,setLogs]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);
  const [testBusy,setTestBusy]=useState(false),[testResult,setTestResult]=useState(null);
  const adminTestInFlight=useRef(false);
  const sendAdminTest=async()=>{
    if(adminTestInFlight.current)return;
    adminTestInFlight.current=true;setTestBusy(true);setTestResult(null);
    try{
      const result=await api.post('/api/platform/operations/telegram-alert-smoke',{});
      setTestResult({failed:!result?.telegramAccepted,message:result?.telegramAccepted?'Telegram test xabarini qabul qildi. Admin chatda yetib kelganini alohida tasdiqlang.':'Telegram test xabari tasdiqlanmadi.'});
    }catch(e){setTestResult({failed:true,message:e?.message||'Telegram test xabarini yuborib bo‘lmadi.'})}
    finally{adminTestInFlight.current=false;setTestBusy(false)}
  };
  useEffect(()=>{const id=setTimeout(()=>{setQuery(q);setPage(0)},250);return()=>clearTimeout(id)},[q]);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('');
    api.get(`/api/platform/audit-logs?${new URLSearchParams({q:query,limit:'20',offset:String(page*20)})}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setLogs(data.logs||[]);setMore(Boolean(data.hasMore))}}).catch(e=>{if(!controller.signal.aborted){setLogs([]);setMore(false);setError(e.message)}}).finally(()=>{if(!controller.signal.aborted)setBusy(false)});
    return()=>controller.abort();
  },[query,page,retryKey]);
  return <section className="pro-card"><h2>Audit va monitoring</h2><div className="pro-row-actions"><button type="button" className="pro-btn secondary" disabled={testBusy} onClick={()=>void sendAdminTest()}>{testBusy?'Test yuborilmoqda...':'Admin Telegram test xabari'}</button><small>Faqat admin kanaliga TEST ALERT yuboriladi. Mijozlarga xabar yuborilmaydi.</small></div>{testResult&&<div role={testResult.failed?'alert':'status'} className={`pro-alert ${testResult.failed?'danger':'info'}`}>{testResult.message}</div>}<label className="pro-field"><span>Audit qidiruvi</span><input value={q} onChange={e=>setQ(e.target.value)}/></label>{busy?<div className="pro-empty">Yuklanmoqda...</div>:error?<div role="alert" className="pro-alert danger">{error} <button type="button" className="pro-btn secondary" onClick={()=>setRetryKey(n=>n+1)}>Qayta urinish</button></div>:logs.length?<div className="platform-detail-list">{logs.map(log=><div key={log.id}><span><strong>{log.title||log.action}</strong><small>{log.userName} · {log.description}</small></span><small>{new Date(log.createdAt).toLocaleString('uz-UZ')}</small></div>)}</div>:<div className="pro-empty">Audit yozuvi topilmadi</div>}<div className="platform-pagination"><button className="pro-btn secondary" disabled={busy||!!error||page===0} onClick={()=>setPage(p=>p-1)}>Oldingi</button><span>{page+1} sahifa</span><button className="pro-btn secondary" disabled={busy||!!error||!more} onClick={()=>setPage(p=>p+1)}>Keyingi</button></div></section>;
}

export function BusinessDiagnostics({organization,usage,usageError,view="business"}){
  const [support,setSupport]=useState(null),[supportPage,setSupportPage]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const activeOrganizationRef=useRef(organization.id);
  activeOrganizationRef.current=organization.id;
  const supportRequestRef=useRef(0);
  const [copyResult,setCopyResult]=useState("");
  useEffect(()=>{
    supportRequestRef.current+=1;
    setSupport(null);setSupportPage(0);setBusy(false);setError("");setCopyResult("");
    return ()=>{supportRequestRef.current+=1};
  },[organization.id]);
  const diagnose=async(page=0)=>{
    const organizationId=organization.id,request=++supportRequestRef.current;
    setBusy(true);setError("");
    try{
      const data=await api.get(`/api/platform/organizations/${encodeURIComponent(organizationId)}/support?limit=20&offset=${page*20}`);
      if(request!==supportRequestRef.current||activeOrganizationRef.current!==organizationId)return;
      setSupport(data.support);setSupportPage(page);
    }catch(e){if(request===supportRequestRef.current&&activeOrganizationRef.current===organizationId)setError(e.message)}
    finally{if(request===supportRequestRef.current&&activeOrganizationRef.current===organizationId)setBusy(false)}
  };
  const copyOrganizationId=async()=>{
    if(!navigator.clipboard?.writeText){setCopyResult("Brauzerda nusxalash mavjud emas");return}
    try{await navigator.clipboard.writeText(organization.id);setCopyResult("Biznes ID nusxalandi")}
    catch{setCopyResult("Nusxalashning imkoni bo‘lmadi")}
  };
  const metrics=organization.metrics;
  const fileBytes=Math.max(0,Number(usage?.fileBytes??usage?.receiptBytes??0));
  const estimatedSalesBytes=Math.max(0,Number(usage?.estimatedDatabaseBytes??0));
  const measuredBytes=fileBytes+estimatedSalesBytes;
  return <section className="pro-card" style={{marginTop:16,padding:18}}>{view==="business"&&<><h3>Biznes diagnostikasi</h3><div className="platform-detail-list"><div><span>Biznes ID</span><span className="platform-customer-copy"><strong className="platform-code" title={organization.id}>{organization.id}</strong><button type="button" className="pro-btn secondary" onClick={()=>void copyOrganizationId()} aria-label="Biznes ID nusxalash">Nusxalash</button>{copyResult&&<small role="status">{copyResult}</small>}</span></div><div><span>Ro‘yxatdan o‘tgan</span><strong>{organization.createdAt?new Date(organization.createdAt).toLocaleString('uz-UZ'):'—'}</strong></div><div><span>Oxirgi faollik</span><strong>{organization.lastActivityAt?new Date(organization.lastActivityAt).toLocaleString('uz-UZ'):'Ma’lumot mavjud emas'}</strong></div><div><span>Sinov tugashi</span><strong>{organization.trialEndsAt?new Date(organization.trialEndsAt).toLocaleString('uz-UZ'):'Sinov faol emas'}</strong></div><div><span>Obuna boshlanishi</span><strong>{organization.subscriptionStartedAt?new Date(organization.subscriptionStartedAt).toLocaleString('uz-UZ'):'To‘lov mavjud emas'}</strong></div>{metrics&&<><div><span>Mahsulotlar / savdolar / mijozlar</span><strong>{metrics.products} / {metrics.sales} / {metrics.customers}</strong></div><div><span>Mijozlarning mavjud qarzi</span><strong>{formatPrice(metrics.customerDebt,'UZS')}</strong></div></>}</div></>}{view==="storage"&&<><h3 id="platform-detail-storage">Saqlash hajmi</h3><p className="platform-support-caption">Faqat o‘lchangan fayllar va taxminiy savdo qatorlari hajmi. Tashqi storage va provider limiti o‘lchanmagan bo‘lishi mumkin.</p>{usageError?<div className="pro-alert danger" role="alert">{usageError}</div>:usage?<div className="platform-detail-list">{measuredBytes>0&&<div style={{display:"block"}}><strong>O‘lchangan hajm tarkibi</strong><div role="img" aria-label="Saqlangan fayllar va taxminiy savdo yozuvlari hajmining nisbati" style={{display:"flex",height:10,margin:"10px 0",borderRadius:99,overflow:"hidden",background:"var(--soft-surface)"}}><span style={{width:(fileBytes/measuredBytes*100)+"%",background:"var(--primary)"}}/><span style={{width:(estimatedSalesBytes/measuredBytes*100)+"%",background:"var(--muted)"}}/></div><small>Asosiy rang — o‘lchangan fayllar; ikkinchi rang — taxminiy savdo qatorlari. Bu storage limitiga nisbatan ko‘rsatkich emas.</small></div>}<div><span>Saqlangan fayllar</span><strong>{Math.round(Number(usage.fileBytes??usage.receiptBytes??0)/1048576*100)/100} MB / {(Number(usage.fileBytes??usage.receiptBytes??0)/1073741824).toFixed(3)} GB</strong></div><small>Cheklar va database’da saqlangan fayllar. Tashqi fayllar o‘lchanmagan.</small><div><span>Savdo qatorlari hajmi (taxminiy)</span><strong>{Math.round(Number(usage.estimatedDatabaseBytes??0)/1048576*100)/100} MB</strong></div></div>:<p role="status">Hajm yuklanmoqda...</p>}</>}{view==="support"&&<><h3 id="platform-detail-support">Yordam diagnostikasi</h3><button className="pro-btn secondary" disabled={busy} onClick={()=>diagnose(0)}>{busy?'Tekshirilmoqda...':'Billing va bildirishnomalarni tekshirish'}</button>{error&&<div className="pro-alert danger" role="alert">{error}</div>}{support&&<>{support.apiDiagnosticsReason&&<p className="platform-support-caption">{support.apiDiagnosticsReason}</p>}{(support.apiIssues||[]).map(issue=><div className="platform-support-issue" key={issue.id}><strong>{issue.title||"API xatosi"}</strong><small>{issue.metadata?.status||"Holat noma’lum"} · {issue.created_at?new Date(issue.created_at).toLocaleString("uz-UZ"):"Sana noma’lum"}</small>{issue.metadata?.requestId&&<small className="platform-code">So‘rov: {issue.metadata.requestId}</small>}</div>)}<p className="platform-support-caption"><strong>{support.billingIssues.length}</strong> ta to‘lov muammosi · <strong>{support.deliveryIssues.length}</strong> ta bildirishnoma muammosi · {supportPage+1}-sahifa</p>{support.billingIssues.map(p=><div key={p.id} className="platform-support-issue"><strong>To‘lov: {p.order_id}</strong><small>Holat: {p.status}{p.reject_reason?` · Sabab: ${p.reject_reason}`:""}</small></div>)}{support.deliveryIssues.map(n=><div key={n.id} className="platform-support-issue"><strong>Bildirishnoma</strong><small>{n.status} · {n.attempts} urinish</small></div>)}<div className="platform-pagination"><button className="pro-btn secondary" disabled={busy||supportPage===0} onClick={()=>diagnose(supportPage-1)}>Oldingi</button><span>{supportPage+1} sahifa</span><button className="pro-btn secondary" disabled={busy||!Object.values(support.hasMore||{}).some(Boolean)} onClick={()=>diagnose(supportPage+1)}>Keyingi</button></div></>}</>}</section>;
}

export function RecoveryDashboard({organizationId,initialHistory}){
  const [history,setHistory]=useState(initialHistory),[page,setPage]=useState(0),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const requestRef=useRef(0);
  const activeOrganizationRef=useRef(organizationId);
  activeOrganizationRef.current=organizationId;
  useEffect(()=>{
    requestRef.current+=1;
    setHistory(initialHistory);setPage(0);setPreview(null);setError('');setBusy(false);
    return ()=>{requestRef.current+=1};
  },[organizationId,initialHistory]);
  const load=async(next=page)=>{
    const id=organizationId,request=++requestRef.current;
    setBusy(true);setError('');
    try{
      const result=await api.get(`/api/platform/organizations/${encodeURIComponent(id)}/backups?limit=20&offset=${next*20}`);
      if(request!==requestRef.current||activeOrganizationRef.current!==id)return;
      setHistory(result.backups);setPage(next);
    }catch(e){if(request===requestRef.current&&activeOrganizationRef.current===id)setError(e.message)}
    finally{if(request===requestRef.current&&activeOrganizationRef.current===id)setBusy(false)}
  };
  const dryRun=async(snapshotId)=>{
    const id=organizationId,request=++requestRef.current;
    setBusy(true);setError('');setPreview(null);
    try{
      const result=await api.get(`/api/platform/organizations/${encodeURIComponent(id)}/recovery-preview?${new URLSearchParams({snapshotId})}`);
      if(request!==requestRef.current||activeOrganizationRef.current!==id)return;
      setPreview(result.preview);
    }catch(e){if(request===requestRef.current&&activeOrganizationRef.current===id)setError(e.message)}
    finally{if(request===requestRef.current&&activeOrganizationRef.current===id)setBusy(false)}
  };
  const displayDate=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('uz-UZ'):'Tekshirilmagan';
  const displayStatus=value=>({SUCCESS:"Muvaffaqiyatli",AVAILABLE:"Mavjud",COMPLETED:"Yakunlangan",FAILED:"Xatolik",PENDING:"Kutilmoqda",CREATING:"Yaratilmoqda",ACTIVE:"Faol",READY:"Tayyor"})[String(value||"").toUpperCase()]||value||"Noma’lum";
  const displayAge=value=>{const parsed=Date.parse(value);return Number.isFinite(parsed)?Math.max(0,Math.floor((Date.now()-parsed)/3600000))+" soat":"Noma’lum"};
  return <section aria-label="Backup va recovery"><h3>Backup va tiklash</h3>
    <div role="status" className={`pro-alert ${history?.available?"info":"warning"}`}><strong>{history?.available?"Backup provider ma’lumoti olingan":"Backup tayyorligi tasdiqlanmagan"}</strong><p>{history?.available?"Tiklashdan oldin snapshot qamrovi va sinov tekshiruvini ko‘ring.":"Provider, snapshot va tiklash muddatini alohida tekshirish zarur."}</p></div>
    <button className="pro-btn secondary" disabled={busy} onClick={()=>load()}>{busy?'Yuklanmoqda...':'Provider holatini yangilash'}</button>
    {error&&<div role="alert" className="pro-alert danger">{error}</div>}
    <div className="platform-detail-list">
      <div><span>Provider</span><strong>{history?.provider||'Ulanmagan'}</strong></div>
      <div><span>Tekshiruv holati</span><strong>{history?.available?'Provider javob berdi':'Backup mavjudligi tasdiqlanmagan'}</strong></div>
      <div><span>Qamrov</span><strong>{history?.scope==="ORGANIZATION"?"Faqat bitta biznes":history?.scope==="PROJECT"?"Butun loyiha":history?.scope||"Tekshirilmagan"}</strong></div>
      <div><span>Oxirgi muvaffaqiyatli backup</span><strong>{displayDate(history?.lastSuccessfulBackupAt)}</strong></div>
      <div><span>Vaqt bo‘yicha tiklash oynasi</span><strong>{history?.pitr?(`${Math.round(Number(history.pitr.retentionSeconds||0)/3600*10)/10} soat`):"Tekshirilmagan"}</strong></div>
      <p>{history?.reason}</p>{(history?.warnings||[]).map(text=><p key={text}>{text}</p>)}
      {history?.errorCode&&<p role="alert">Provider xatosi: {history.errorCode}</p>}
      {(history?.snapshots||[]).map(snapshot=><div key={snapshot.id}><span><strong style={{overflowWrap:'anywhere'}}>{snapshot.name||snapshot.id}</strong><small>{snapshot.id} · {displayDate(snapshot.createdAt)} · {snapshot.scope==='ORGANIZATION'?'Bitta biznes':snapshot.scope==='PROJECT'?'Butun loyiha':snapshot.scope||'Noma’lum'}</small><small>Tiklash nuqtasi: {displayDate(snapshot.recoveryPoint)} · Holat: {displayStatus(snapshot.status)}</small><small>Backup yoshi: {displayAge(snapshot.createdAt)}</small></span><button className="pro-btn secondary" disabled={busy} onClick={()=>dryRun(snapshot.id)}>Sinov tekshiruvi</button></div>)}
      {history?.available&&!history.snapshots?.length&&<p>Snapshot topilmadi.</p>}
    </div>
    {history&&<div className="platform-pagination"><button className="pro-btn secondary" disabled={busy||page===0} onClick={()=>load(page-1)}>Oldingi</button><span>{page+1} sahifa / {history.total??history.snapshots?.length??0} snapshot</span><button className="pro-btn secondary" disabled={busy||!history.hasMore} onClick={()=>load(page+1)}>Keyingi</button></div>}
    {preview&&<div className="pro-alert" role="status"><strong>O‘qish rejimidagi tiklash tekshiruvi</strong><p>Biznes: {preview.organizationId}; snapshot: {preview.snapshot.id}; scope: {preview.scope}</p><p>{preview.affectedScope}</p><p>Bu tekshiruv ma’lumotlarni tiklamaydi. Haqiqiy ma’lumotlar farqi hisoblanmagan.</p>{preview.conflicts.map(item=><p key={item}>{item}</p>)}{preview.requirements.map(item=><p key={item}>{item}</p>)}</div>}
    <p className="platform-support-caption">Tiklash uchun alohida muhitda sinov va mas’ul mutaxassis tekshiruvi talab etiladi. Bu sahifadan jonli ma’lumotlar tiklanmaydi.</p>
  </section>;
}
