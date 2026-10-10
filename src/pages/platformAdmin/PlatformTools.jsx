import {useState,useEffect} from 'react';
import {api} from '../../services/apiClient';
import {formatPrice} from '../../utils/formatPrice';
import {StatCard} from '../../components/Ui';
import {FiShield,FiCreditCard,FiUsers} from 'react-icons/fi';

export function PlatformSummary({overview}){
  if(!overview)return <div className="pro-empty">Statistika yuklanmoqda...</div>;
  return <>{overview.trialVerification?.configuredMode==='temporary_disabled'&&<div className="pro-alert" role="alert">SMSsiz trial rejimi: telefon egaligi tasdiqlanmaydi. Tugash sanasi: {overview.trialVerification.temporaryUntil}. {overview.trialVerification.temporaryExpired?'Muddat tugagan; SMS tasdiqlash majburiy.':'Muddat tugaganda SMS tasdiqlash majburiy bo\'ladi.'}</div>}<div className="pro-stat-grid">{[['trial','Sinovdagi bizneslar'],['suspended','Bloklangan bizneslar'],['paymentBlocked','To‘lovgacha bloklangan'],['expired','Tugagan obunalar']].map(([key,label])=><StatCard key={key} icon={FiShield} label={label} value={overview[key]??'—'}/>)}</div><div className="pro-stat-grid"><StatCard icon={FiCreditCard} label="Tasdiqlangan to‘lovlar daromadi" value={formatPrice(overview.revenue||0,'UZS')} hint="Barcha davr; tasdiqlangan to‘lovlar"/><StatCard icon={FiUsers} label="Oylik / yillik bizneslar" value={`${overview.plans?.MONTHLY??'—'} / ${overview.plans?.ANNUAL??'—'}`}/><StatCard icon={FiCreditCard} label="Tasdiqlangan obuna to‘lovlari" value={overview.subscriptions??'—'}/></div></>;
}

export function PlatformAudit(){
  const [q,setQ]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0),[logs,setLogs]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);
  useEffect(()=>{const id=setTimeout(()=>{setQuery(q);setPage(0)},250);return()=>clearTimeout(id)},[q]);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('');
    api.get(`/api/platform/audit-logs?${new URLSearchParams({q:query,limit:'20',offset:String(page*20)})}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setLogs(data.logs||[]);setMore(Boolean(data.hasMore))}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setBusy(false)});
    return()=>controller.abort();
  },[query,page]);
  return <section className="pro-card"><h2>Audit va monitoring</h2><label className="pro-field"><span>Audit qidiruvi</span><input value={q} onChange={e=>setQ(e.target.value)}/></label>{busy?<div className="pro-empty">Yuklanmoqda...</div>:error?<div role="alert" className="pro-alert danger">{error}</div>:logs.length?<div className="platform-detail-list">{logs.map(log=><div key={log.id}><span><strong>{log.title||log.action}</strong><small>{log.userName} · {log.description}</small></span><small>{new Date(log.createdAt).toLocaleString('uz-UZ')}</small></div>)}</div>:<div className="pro-empty">Audit yozuvi topilmadi</div>}<div className="platform-pagination"><button className="pro-btn secondary" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Oldingi</button><span>{page+1} sahifa</span><button className="pro-btn secondary" disabled={busy||!more} onClick={()=>setPage(p=>p+1)}>Keyingi</button></div></section>;
}

export function BusinessDiagnostics({organization,usage,usageError}){
  const [support,setSupport]=useState(null),[supportPage,setSupportPage]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const diagnose=async(page=0)=>{setBusy(true);setError('');try{const data=await api.get(`/api/platform/organizations/${organization.id}/support?limit=20&offset=${page*20}`);setSupport(data.support);setSupportPage(page)}catch(e){setError(e.message)}finally{setBusy(false)}};
  const metrics=organization.metrics;
  return <section className="pro-card" style={{marginTop:16,padding:18}}><h3>Biznes diagnostikasi</h3><div className="platform-detail-list"><div><span>Biznes ID</span><strong>{organization.id}</strong></div><div><span>Ro‘yxatdan o‘tgan</span><strong>{organization.createdAt?new Date(organization.createdAt).toLocaleString('uz-UZ'):'—'}</strong></div><div><span>Oxirgi faollik</span><strong>{organization.lastActivityAt?new Date(organization.lastActivityAt).toLocaleString('uz-UZ'):'Ma’lumot mavjud emas'}</strong></div><div><span>Sinov tugashi</span><strong>{organization.trialEndsAt?new Date(organization.trialEndsAt).toLocaleString('uz-UZ'):'Sinov faol emas'}</strong></div><div><span>Obuna boshlanishi</span><strong>{organization.subscriptionStartedAt||'To‘lov mavjud emas'}</strong></div>{metrics&&<><div><span>Mahsulotlar / savdolar / mijozlar</span><strong>{metrics.products} / {metrics.sales} / {metrics.customers}</strong></div><div><span>Mijozlarning mavjud qarzi</span><strong>{formatPrice(metrics.customerDebt,'UZS')}</strong></div></>}</div><h3>Storage monitoring</h3>{usageError?<div className="pro-alert danger" role="alert">{usageError}</div>:usage?<div className="platform-detail-list"><div><span>Saqlangan fayllar</span><strong>{Math.round(Number(usage.fileBytes??usage.receiptBytes??0)/1048576*100)/100} MB / {(Number(usage.fileBytes??usage.receiptBytes??0)/1073741824).toFixed(3)} GB</strong></div><small>Cheklar va database’da saqlangan fayllar. Tashqi fayllar o‘lchanmagan.</small><div><span>Savdo qatorlari hajmi (taxminiy)</span><strong>{Math.round(Number(usage.estimatedDatabaseBytes??0)/1048576*100)/100} MB</strong></div></div>:<p>Hajm yuklanmoqda...</p>}<h3>Support center</h3><button className="pro-btn secondary" disabled={busy} onClick={()=>diagnose(0)}>{busy?'Tekshirilmoqda...':'Billing va bildirishnomalarni tekshirish'}</button>{error&&<div className="pro-alert danger" role="alert">{error}</div>}{support&&<><p>{support.apiDiagnosticsReason}</p>{(support.apiIssues||[]).map(issue=><p key={issue.id}>{issue.title}: {issue.metadata?.status} - {issue.metadata?.requestId} - {new Date(issue.created_at).toLocaleString("uz-UZ")}</p>)}<p>To‘lov muammolari: {support.billingIssues.length}; bildirishnoma muammolari: {support.deliveryIssues.length} ({supportPage+1}-sahifa).</p>{support.billingIssues.map(p=><p key={p.id}>{p.order_id}: {p.status} {p.reject_reason}</p>)}{support.deliveryIssues.map(n=><p key={n.id}>{n.status}: {n.attempts} urinish</p>)}<div className="platform-pagination"><button className="pro-btn secondary" disabled={busy||supportPage===0} onClick={()=>diagnose(supportPage-1)}>Oldingi</button><span>{supportPage+1} sahifa</span><button className="pro-btn secondary" disabled={busy||!Object.values(support.hasMore||{}).some(Boolean)} onClick={()=>diagnose(supportPage+1)}>Keyingi</button></div></>}</section>;
}

export function RecoveryDashboard({organizationId,initialHistory}){
  const [history,setHistory]=useState(initialHistory),[page,setPage]=useState(0),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setHistory(initialHistory);setPage(0);setPreview(null);setError('')},[organizationId,initialHistory]);
  const load=async(next=page)=>{setBusy(true);setError('');try{const result=await api.get(`/api/platform/organizations/${organizationId}/backups?limit=20&offset=${next*20}`);setHistory(result.backups);setPage(next)}catch(e){setError(e.message)}finally{setBusy(false)}};
  const dryRun=async(snapshotId)=>{setBusy(true);setError('');setPreview(null);try{const result=await api.get(`/api/platform/organizations/${organizationId}/recovery-preview?${new URLSearchParams({snapshotId})}`);setPreview(result.preview)}catch(e){setError(e.message)}finally{setBusy(false)}};
  const displayDate=value=>value?new Date(value).toLocaleString('uz-UZ'):'Tekshirilmagan';
  return <section aria-label="Backup va recovery"><h3>Backup va recovery</h3>
    <button className="pro-btn secondary" disabled={busy} onClick={()=>load()}>{busy?'Yuklanmoqda...':'Provider holatini yangilash'}</button>
    {error&&<div role="alert" className="pro-alert danger">{error}</div>}
    <div className="platform-detail-list">
      <div><span>Provider</span><strong>{history?.provider||'Ulanmagan'}</strong></div>
      <div><span>Tekshiruv holati</span><strong>{history?.available?'Metadata olindi':'Backup mavjud emas yoki tekshirilmagan'}</strong></div>
      <div><span>Scope</span><strong>{history?.scope||'UNKNOWN'}</strong></div>
      <div><span>Oxirgi muvaffaqiyatli backup</span><strong>{displayDate(history?.lastSuccessfulBackupAt)}</strong></div>
      <div><span>PITR retention</span><strong>{history?.pitr?`${history.pitr.retentionSeconds} soniya`:'Tekshirilmagan'}</strong></div>
      <p>{history?.reason}</p>{(history?.warnings||[]).map(text=><p key={text}>{text}</p>)}
      {history?.errorCode&&<p role="alert">Provider xatosi: {history.errorCode}</p>}
      {(history?.snapshots||[]).map(snapshot=><div key={snapshot.id}><span><strong style={{overflowWrap:'anywhere'}}>{snapshot.name||snapshot.id}</strong><small>{snapshot.id} · {displayDate(snapshot.createdAt)} · {snapshot.scope||'UNKNOWN'}</small><small>Recovery point: {displayDate(snapshot.recoveryPoint)}; status: {snapshot.status}</small><small>Backup yoshi: {Math.max(0,Math.floor((Date.now()-Date.parse(snapshot.createdAt))/3600000))} soat</small></span><button className="pro-btn secondary" disabled={busy} onClick={()=>dryRun(snapshot.id)}>Dry-run preview</button></div>)}
      {history?.available&&!history.snapshots?.length&&<p>Snapshot topilmadi.</p>}
    </div>
    {history&&<div className="platform-pagination"><button className="pro-btn secondary" disabled={busy||page===0} onClick={()=>load(page-1)}>Oldingi</button><span>{page+1} sahifa / {history.total??history.snapshots?.length??0} snapshot</span><button className="pro-btn secondary" disabled={busy||!history.hasMore} onClick={()=>load(page+1)}>Keyingi</button></div>}
    {preview&&<div className="pro-alert" role="status"><strong>Read-only restore preview</strong><p>Biznes: {preview.organizationId}; snapshot: {preview.snapshot.id}; scope: {preview.scope}</p><p>{preview.affectedScope}</p><p>Haqiqiy diff hisoblanmagan. Taxminiy o'zgarishlar ko'rsatilmaydi.</p>{preview.conflicts.map(item=><p key={item}>{item}</p>)}{preview.requirements.map(item=><p key={item}>{item}</p>)}</div>}
    <p>Restore readiness: tekshirilmagan. Rollback va izolyatsiyalangan restore drill talab qilinadi.</p><button className="pro-btn secondary" disabled>Tiklash hozir mavjud emas</button>
  </section>;
}
