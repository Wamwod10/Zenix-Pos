import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {FiX} from 'react-icons/fi';
import {api} from '../../services/apiClient';
import {useStore} from '../../context/StoreContext';
import {useAuth} from '../../context/AuthContext';
import {PremiumSelect} from '../../components/Ui';
import './zenixAi.scss';

const actionLabels={PENDING:'Tasdiqlash kutilmoqda',EXECUTING:'Bajarilmoqda…',SUCCEEDED:'Bajarildi',CONFIRMED:'Bajarildi',FAILED:'Bajarilmadi',CANCELLED:'Bekor qilindi',EXPIRED:'Tasdiqlash muddati tugadi',STALE:'Ma’lumot o‘zgargan. Yangi kirim taklifini so‘rang.'};
const actionData=response=>response?.action||response;
const unresolved=action=>action.status==='EXECUTING'||action.uncertain;

function ActionCard({action,writesEnabled,onAction,now}){
 const expired=action.status==='PENDING'&&(!Number.isFinite(Date.parse(action.expiresAt))||Date.parse(action.expiresAt)<=now);
 const state=expired?'EXPIRED':action.status,pending=state==='PENDING',preview=action.preview||{};
 const canConfirm=pending&&!action.uncertain&&writesEnabled&&action.type==='stock_receipt'&&Boolean(action.confirmationToken);
 return <section className="zenix-ai-action" aria-label="Kirimni tasdiqlash" data-status={state}>
  <strong>Omborga kirim</strong>
  <dl><div><dt>Mahsulot</dt><dd>{preview.productName||'—'}</dd></div><div><dt>Filial</dt><dd>{preview.storeName||'—'}</dd></div><div><dt>Ombor</dt><dd>{preview.warehouseName||'—'}</dd></div><div><dt>Miqdor</dt><dd>{preview.quantity??'—'} {preview.unit||''}</dd></div><div><dt>Tannarx</dt><dd>{preview.costPrice??'—'} so‘m</dd></div></dl>
  {action.expiresAt&&<small>Tasdiqlash muddati: {new Date(action.expiresAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})} (Toshkent)</small>}
  <p role="status">{actionLabels[state]||'Holatni tekshirish kerak'}</p>
  {action.error&&<p className="zenix-ai-error" role="alert">{action.error}</p>}
  {action.result?.receiptId&&['SUCCEEDED','CONFIRMED'].includes(state)&&<small>Kirim hujjati: {action.result.receiptId}</small>}
  {pending&&!writesEnabled&&<small>Kirimni tasdiqlash hozir o‘chirilgan.</small>}
  {pending&&<div className="zenix-ai-action-buttons"><button type="button" className="pro-btn primary" disabled={!canConfirm||action.checking} onClick={()=>onAction(action,'confirm')}>Tasdiqlash</button><button type="button" className="pro-btn" disabled={!action.confirmationToken||action.checking||action.uncertain} onClick={()=>onAction(action,'cancel')}>Bekor qilish</button></div>}
  {(action.uncertain||state==='EXECUTING')&&<button type="button" className="pro-btn" disabled={action.checking} onClick={()=>onAction(action,'status')}>Holatni tekshirish</button>}
 </section>;
}

function Chat({scope,open}){
 const {currentUser}=useAuth(),{hasPermission,reloadStore}=useStore();
 const [status,setStatus]=useState(null),[question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now);
 const mounted=useRef(false),controller=useRef(null),retry=useRef(null),sending=useRef(false),bottom=useRef(null),conversation=useRef(null),actionLocks=useRef(new Set()),actionControllers=useRef(new Set());
 const refresh=useCallback(async signal=>{const data=await api.get('/api/ai/status',{signal});if(mounted.current&&!signal?.aborted)setStatus(data)},[]);
 useEffect(()=>{mounted.current=true;const c=new AbortController();refresh(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>{mounted.current=false;c.abort();controller.current?.abort();actionControllers.current.forEach(c=>c.abort())}},[refresh]);
 useEffect(()=>{if(open)bottom.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'})},[messages,busy,open]);
 const pending=messages.some(m=>m.actions?.some(a=>a.status==='PENDING'));
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[pending]);
 const canBill=hasPermission('moduleBilling',currentUser?.appRole);
 const blocked=status&&!status.limit?'ZENIX AI Business va Premium tariflarida mavjud.':status&&!status.writable?'Obuna muddati tugagan. Ma’lumotlaringiz saqlangan; AI uchun tarifni faollashtirish kerak.':status&&!status.enabled?'ZENIX AI ulanishi hali faollashtirilmagan. POS modullaridan foydalanishda davom etishingiz mumkin.':status&&status.remaining<=0?'Oylik AI so‘rovlari tugagan. POS modullari ishlashda davom etadi.':'';
 const patchAction=(id,patch)=>{if(mounted.current)setMessages(old=>old.map(m=>({...m,actions:(m.actions||[]).map(a=>a.id===id?{...a,...patch,confirmationToken:patch.confirmationToken||a.confirmationToken,preview:patch.preview||a.preview}:a)})))};
 async function runAction(action,operation){
  if(actionLocks.current.has(action.id))return;
  if(operation!=='status'&&(action.status!=='PENDING'||action.uncertain||!action.confirmationToken||!Number.isFinite(Date.parse(action.expiresAt))||Date.parse(action.expiresAt)<=Date.now()))return;
  if(operation==='confirm'&&(status?.writesEnabled!==true||action.type!=='stock_receipt'))return;
  actionLocks.current.add(action.id);patchAction(action.id,{checking:true,error:'',...(operation==='status'?{}:{status:'EXECUTING'})});
  const c=new AbortController();actionControllers.current.add(c);const timer=setTimeout(()=>c.abort(),25000);
  const apply=response=>{
   const data=actionData(response);if(!data?.status)throw Error('Amal holati olinmadi.');
   patchAction(action.id,{...data,checking:false,uncertain:false,error:''});
   if(['SUCCEEDED','CONFIRMED'].includes(data.status)&&mounted.current)void reloadStore?.({silent:true});
  };
  try{
   const response=operation==='status'?await api.get(`/api/ai/actions/${encodeURIComponent(action.id)}/status`,{signal:c.signal}):await api.post(`/api/ai/actions/${encodeURIComponent(action.id)}/${operation}`,{confirmationToken:action.confirmationToken},{signal:c.signal});
   if(mounted.current&&!c.signal.aborted)apply(response);
  }catch{
   if(!mounted.current)return;
   // A lost response can follow a successful write. Only server status unlocks retry.
   patchAction(action.id,{checking:false,uncertain:true,error:'Natija hali tasdiqlanmadi. Holatni tekshiring.'});
   if(operation!=='status'){
    const recovery=new AbortController();actionControllers.current.add(recovery);const recoveryTimer=setTimeout(()=>recovery.abort(),25000);
    try{const response=await api.get(`/api/ai/actions/${encodeURIComponent(action.id)}/status`,{signal:recovery.signal});if(mounted.current&&!recovery.signal.aborted)apply(response)}catch{/* Keep confirmation disabled until status is known. */}
    finally{clearTimeout(recoveryTimer);actionControllers.current.delete(recovery)}
   }
  }finally{clearTimeout(timer);actionControllers.current.delete(c);actionLocks.current.delete(action.id)}
 }
 async function submit(event){
  event.preventDefault();const text=question.trim();if(!text||busy||sending.current||blocked||!status)return;
  sending.current=true;setBusy(true);setError('');
  const body=retry.current?.question===text?retry.current:{requestId:crypto.randomUUID(),question:text,storeId:scope||null,conversationId:conversation.current};retry.current=body;
  const c=new AbortController();controller.current=c;const timer=setTimeout(()=>c.abort(),25000);
  try{
   const response=await api.post('/api/ai/chat',body,{signal:c.signal});
   if(mounted.current&&!c.signal.aborted){
    conversation.current=response.conversationId||conversation.current;
    setMessages(old=>{
     const known=new Map(old.flatMap(m=>m.actions||[]).map(a=>[a.id,a]));
     const actions=response.actions?.map(action=>{const previous=known.get(action.id);return action.status==='PENDING'&&previous&&(unresolved(previous)||previous.status!=='PENDING')?previous:action});
     return [...old.filter((m,index)=>index>=old.length-18||m.actions?.some(unresolved)),{...response,actions,id:body.requestId,question:text}];
    });
    setQuestion('');retry.current=null;
   }
  }catch(e){if(mounted.current&&!c.signal.aborted){setError(e.message||'AI javobini olib bo‘lmadi. Qayta urining.');if(e.status&&e.code!=='AI_REQUEST_PENDING')retry.current=null}else if(mounted.current)setError('AI javobi kechikdi. Ayni savolni qayta yuboring.')}
  finally{clearTimeout(timer);sending.current=false;if(mounted.current){setBusy(false);refresh().catch(()=>{})}}
 }
 return <>
  <button className="pro-btn" type="button" disabled={busy||messages.some(m=>m.actions?.some(unresolved))} onClick={()=>{conversation.current=null;retry.current=null;setMessages([]);setQuestion('');setError('')}}>Yangi suhbat</button>
  <div className="pro-card zenix-ai-summary"><div><strong>{status?.planCode||'Joriy tarif'}</strong><p>{status?`${status.remaining} / ${status.limit} ta so‘rov qoldi`:'AI holati yuklanmoqda…'}</p><small>{status?.resetsAt&&`Limit yangilanishi: ${new Date(status.resetsAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})} (Toshkent)`}</small></div>{canBill&&<Link className="pro-btn" to="/billing">Tarif va to‘lovlar</Link>}</div>
  {blocked&&<div className="pro-card zenix-ai-notice" role="status"><p>{blocked}</p>{canBill&&(!status.limit||status.remaining<=0)&&<Link className="pro-btn primary" to="/billing">Tarifni oshirish</Link>}</div>}
  <div className="pro-card zenix-ai-chat">
   <div className="zenix-ai-suggestions" aria-label="Tavsiya etilgan savollar">{status?.suggestions?.map(s=><button type="button" className="pro-btn" key={s.topic} disabled={busy||Boolean(blocked)} onClick={()=>setQuestion(s.question)}>{s.question}</button>)}</div>
   <div className="zenix-ai-messages" aria-live="polite" aria-relevant="additions">
    {!messages.length&&<div className="pro-empty"><strong>Biznesingiz haqida savol bering</strong><span>Savdo, qoldiq va ruxsat berilgan hisobotlarni tahlil qiling. Suhbat sahifalar orasida saqlanadi.</span></div>}
    {messages.map(m=><article key={m.id}><p className="zenix-ai-question">{m.question}</p><div className="zenix-ai-answer"><strong>ZENIX AI</strong><p>{m.answer}</p>
     {m.report&&<><small>{m.report.from} — {m.report.to} · {m.report.storeId?'Tanlangan filial':'Barcha filiallar'}{m.report.sellerScoped?' · Faqat o‘z savdolaringiz':''}</small><div className="zenix-ai-facts">{m.report.facts?.map(f=><div key={f.id}><small>{f.label}</small><strong>{f.value===null?'Ma’lumot yetarli emas':`${f.value}${f.unit==='UZS'?' so‘m':f.unit==='count'?' ta':''}`}</strong></div>)}</div>
     {m.report.tables?.map((t,i)=><div className="zenix-ai-table" key={i}><table><caption>{t.title}</caption><thead><tr>{t.columns.map((col,j)=><th key={j}>{col}</th>)}</tr></thead><tbody>{t.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell??'Ma’lumot yetarli emas'}</td>)}</tr>)}</tbody></table>{!t.rows.length&&<p>Ushbu davrda mos ma’lumot topilmadi.</p>}</div>)}</>}
     {[...(m.report?.notes||[]),...(m.insights||[])].map((text,i)=><p className="zenix-ai-note" key={i}>{text}</p>)}
     {m.actions?.map(action=><ActionCard key={action.id} action={action} writesEnabled={status?.writesEnabled===true} onAction={runAction} now={now}/>)}
    </div></article>)}
    {busy&&<p role="status">Biznes ko‘rsatkichlari tahlil qilinmoqda…</p>}<div ref={bottom}/>
   </div>
   {error&&<p role="alert" className="zenix-ai-error">{error}</p>}
   <form onSubmit={submit} className="zenix-ai-compose"><label htmlFor="zenix-ai-question">Savolingiz</label><textarea id="zenix-ai-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} rows={3} disabled={busy||Boolean(blocked)} placeholder="Bugun qancha savdo bo‘ldi?"/><button className="pro-btn primary" type="submit" disabled={busy||Boolean(blocked)||!status||!question.trim()}>{busy?'Tahlil qilinmoqda…':'Yuborish'}</button></form>
   <small>Kirim faqat kartadagi Tasdiqlash tugmasi orqali bajariladi. Ma’lumotlarni avval tekshiring.</small>
  </div>
 </>;
}

export default function ZenixAI({open,onClose}){
 const {currentUser}=useAuth(),{currentStoreId,stores}=useStore();
 const [scope,setScope]=useState(currentStoreId||''),[activated,setActivated]=useState(open);
 const panel=useRef(null),previousFocus=useRef(null);
 useEffect(()=>{if(!open)return;setActivated(true);previousFocus.current=document.activeElement;panel.current?.querySelector('button')?.focus();return()=>previousFocus.current?.isConnected&&previousFocus.current.focus()},[open]);
 const locked=['CASHIER','SALES','WAREHOUSE'].includes(currentUser?.appRole);
 return <aside id="zenix-ai-panel" className="zenix-ai zenix-ai-panel" ref={panel} hidden={!open} role="dialog" aria-label="ZENIX AI yordamchi" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose()}}}>
  <div className="zenix-ai-panel-head"><div><strong>ZENIX AI</strong><small>Biznes yordamchi</small></div><button className="pro-btn" type="button" onClick={onClose} aria-label="AI panelini yopish"><FiX/></button></div>
  {!locked&&<PremiumSelect value={scope} onChange={event=>setScope(event.target.value)} aria-label="AI filial doirasi"><option value="">Barcha filiallar</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</PremiumSelect>}
  {activated&&<Chat key={scope} scope={scope} open={open}/>}
 </aside>;
}
