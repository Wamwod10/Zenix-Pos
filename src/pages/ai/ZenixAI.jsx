import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {FiX,FiMinus,FiMaximize2,FiMinimize2,FiPlus,FiArrowUp,FiBarChart2,FiPackage,FiTrendingUp,FiArchive,FiClock,FiChevronDown,FiShield} from 'react-icons/fi';
import {api} from '../../services/apiClient';
import {useStore} from '../../context/StoreContext';
import {useAuth} from '../../context/AuthContext';
import {PremiumSelect} from '../../components/Ui';
import ZenixAIIcon from '../../components/ZenixAIIcon';
import {useFeedback} from '../../context/FeedbackContext';
import {aiState,aiSuggestions,shouldFollowChat,aiErrorMessage,aiMessageReports} from './aiPresentation';
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

function Chat({scope,onScope,stores,locked,open,mode,onModeChange,onClose}){
 const {currentUser}=useAuth(),{hasPermission,reloadStore}=useStore();
 const {confirm}=useFeedback();
 const [status,setStatus]=useState(null),[statusLoading,setStatusLoading]=useState(true),[question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now);
 const mounted=useRef(false),controller=useRef(null),retry=useRef(null),sending=useRef(false),bottom=useRef(null),conversation=useRef(null),actionLocks=useRef(new Set()),actionControllers=useRef(new Set());
 const input=useRef(null),scroller=useRef(null),follow=useRef(true),previousCount=useRef(0),[newReply,setNewReply]=useState(false),[resetBusy,setResetBusy]=useState(false);
 const refresh=useCallback(async signal=>{if(mounted.current)setStatusLoading(true);try{const data=await api.get('/api/ai/status',{signal});if(mounted.current&&!signal?.aborted)setStatus(data)}finally{if(mounted.current&&!signal?.aborted)setStatusLoading(false)}},[]);
 async function retryStatus(){setError('');controller.current?.abort();const c=new AbortController();controller.current=c;try{await refresh(c.signal)}catch(e){if(mounted.current&&!c.signal.aborted)setError(e.message)}}
 useEffect(()=>{mounted.current=true;const c=new AbortController();refresh(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>{mounted.current=false;c.abort();controller.current?.abort();actionControllers.current.forEach(c=>c.abort())}},[refresh]);
 useLayoutEffect(()=>{if(!open)return;const node=scroller.current;if(!messages.length&&!busy){if(node)node.scrollTop=0;follow.current=true;setNewReply(false)}else if(follow.current&&node){node.scrollTop=node.scrollHeight;setNewReply(false)}else if(messages.length>previousCount.current)setNewReply(true);previousCount.current=messages.length},[messages,busy,open,mode]);
 useEffect(()=>{const node=input.current;if(node&&open){node.style.height='auto';node.style.height=`${Math.min(node.scrollHeight||48,160)}px`}},[question,open,mode]);
 const pending=messages.some(m=>m.actions?.some(a=>a.status==='PENDING'&&Date.parse(a.expiresAt)>now));
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[pending]);
 const canBill=hasPermission('moduleBilling',currentUser?.appRole);
 const blocked=status&&!status.enabled?'ZENIX AI hozircha faollashtirilmagan.':status&&!status.limit?'ZENIX AI Business va Premium tariflarida mavjud.':status&&!status.writable?'Obuna muddati tugagan. Ma’lumotlaringiz saqlangan; AI uchun tarifni faollashtirish kerak.':status&&status.remaining<=0?'Oylik AI so‘rovlari tugagan. POS modullari ishlashda davom etadi.':'';
 const state=aiState(status,busy,error),cards=aiSuggestions(status,p=>hasPermission(p,currentUser?.appRole));
 const unsettled=messages.some(m=>m.actions?.some(unresolved)),hasContext=Boolean(messages.length||question.trim());
 async function newChat(){
  if(busy||unsettled||pending||resetBusy)return;
  setResetBusy(true);
  try{if(hasContext&&!await confirm({title:'Yangi suhbat boshlaysizmi?',message:'Joriy suhbat va yozilmagan matn tozalanadi. Bu amalni ortga qaytarib bo‘lmaydi.',confirmLabel:'Yangi suhbat boshlash',tone:'warning'}))return;
   if(!mounted.current)return;conversation.current=null;retry.current=null;setMessages([]);setQuestion('');setError('');follow.current=true;setNewReply(false);input.current?.focus();
  }finally{if(mounted.current)setResetBusy(false)}
 }
 async function changeScope(value){
  if(busy||pending||unsettled||value===scope)return;
  if(hasContext&&!await confirm({title:'Suhbat filialini almashtirasizmi?',message:'Boshqa filial uchun yangi suhbat boshlanadi. Joriy suhbat va matn tozalanadi.',confirmLabel:'Filialni almashtirish',tone:'warning'}))return;
  if(mounted.current)onScope(value);
 }
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
  sending.current=true;setBusy(true);setError('');follow.current=true;setNewReply(false);
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
  }catch(e){if(mounted.current&&!c.signal.aborted){setError(aiErrorMessage(e));if(e.status&&e.code!=='AI_REQUEST_PENDING')retry.current=null}else if(mounted.current)setError('AI javobi kechikdi. Ayni savolni qayta yuboring.')}
  finally{clearTimeout(timer);sending.current=false;if(mounted.current){setBusy(false);refresh().catch(()=>{})}}
 }
 return <>
  <header className="zenix-ai-panel-head">
   <div className="zenix-ai-brand"><span className="zenix-ai-mark"><ZenixAIIcon/></span><div><strong>ZENIX AI</strong><small>Biznes yordamchingiz</small></div></div>
   <span className="zenix-ai-state" data-state={state.key} role="status"><i aria-hidden="true"/>{state.label}</span>
   <div className="zenix-ai-panel-controls">
    <button className="zenix-ai-new" type="button" disabled={busy||unsettled||pending||resetBusy} onClick={newChat} title="Yangi suhbat"><FiPlus aria-hidden="true"/><span>Yangi suhbat</span></button>
    <button type="button" onClick={onClose} aria-label="AI panelini minimallashtirish" title="Minimallashtirish"><FiMinus aria-hidden="true"/></button>
    <button type="button" onClick={()=>onModeChange(mode==='expanded'?'compact':'expanded')} aria-label={mode==='expanded'?'Ixcham panelga o‘tish':'Keng workspace ochish'} title={mode==='expanded'?'Ixcham panel':'Keng workspace'}>{mode==='expanded'?<FiMinimize2 aria-hidden="true"/>:<FiMaximize2 aria-hidden="true"/>}</button>
    <button type="button" onClick={onClose} aria-label="AI panelini yopish" title="Yopish"><FiX aria-hidden="true"/></button>
   </div>
  </header>
  <div className="zenix-ai-context">
   <div className="zenix-ai-summary"><FiShield aria-hidden="true"/><strong>{status?.planCode||'Tarif'}</strong><span>{status?`${status.remaining} / ${status.limit} ta so‘rov qoldi`:statusLoading?'Holat yuklanmoqda…':'Holat olinmadi'}</span>{status?.resetsAt&&<span className="zenix-ai-reset-date" title={`Limit yangilanishi: ${new Date(status.resetsAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})} (Toshkent)`}><FiClock aria-hidden="true"/></span>}</div>
   <div className="zenix-ai-scope">{!locked?<PremiumSelect value={scope} disabled={busy||pending||unsettled} onChange={event=>void changeScope(event.target.value)} aria-label="AI filial doirasi"><option value="">Barcha filiallar</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</PremiumSelect>:<span>{stores.find(s=>s.id===scope)?.name||'Biriktirilgan filial'}</span>}</div>
   {canBill&&<Link className="zenix-ai-billing" to="/billing">Tarif va to‘lovlar</Link>}
  </div>
  <div className="zenix-ai-scope-note">Suhbat doirasi: <strong>{stores.find(s=>s.id===scope)?.name||(locked?'Biriktirilgan filial':'Barcha filiallar')}</strong><span> · Filial almashsa, yangi suhbat boshlanadi.</span></div>
  {!status&&<button className="pro-btn zenix-ai-retry-status" type="button" onClick={retryStatus} disabled={statusLoading}>{statusLoading?'Yuklanmoqda…':'Holatni qayta yuklash'}</button>}
  {blocked&&<div className="pro-card zenix-ai-notice" role="status"><p>{blocked}</p>{status.enabled&&canBill&&(!status.limit||status.remaining<=0)&&<Link className="pro-btn primary" to="/billing">Tarifni oshirish</Link>}</div>}
  <div className="zenix-ai-chat">
   <div className="zenix-ai-scroll" ref={scroller} onScroll={()=>{follow.current=shouldFollowChat(scroller.current);if(follow.current)setNewReply(false)}}>
   {!messages.length&&<section className="zenix-ai-welcome"><span className="zenix-ai-welcome-mark"><ZenixAIIcon/></span><small>BIZNESINGIZ UCHUN ISHONCHLI YORDAMCHI</small><h1>Bugun biznesingiz uchun<br/>nima qilamiz?</h1><p>Savollaringizga javob olishingiz, biznesingizni tahlil qilishingiz yoki xavfsiz amallarni tayyorlashingiz mumkin.</p>
    <div className="zenix-ai-suggestion-cards">{cards.map(card=>{const Icon={sales:FiBarChart2,stock:FiPackage,profit:FiTrendingUp,receipt:FiArchive}[card.id];return <button type="button" key={card.id} disabled={busy||Boolean(blocked)} onClick={()=>{setQuestion(card.question);input.current?.focus()}}><Icon aria-hidden="true"/><span><strong>{card.title}</strong><small>{card.question}</small></span><span className="zenix-ai-card-arrow" aria-hidden="true">↗</span></button>})}</div>
    {Boolean(status?.suggestions?.length)&&<details className="zenix-ai-examples"><summary>Ko‘proq savollar <FiChevronDown aria-hidden="true"/></summary><div className="zenix-ai-suggestions" aria-label="Tavsiya etilgan savollar">{status.suggestions.map(s=><button type="button" key={s.topic} disabled={busy||Boolean(blocked)} onClick={()=>{setQuestion(s.question);input.current?.focus()}}>{s.question}</button>)}</div></details>}
   </section>}
   {messages.length>0&&<details className="zenix-ai-history"><summary><FiClock aria-hidden="true"/> Joriy suhbat · {messages.length} savol</summary><ol>{messages.map(m=><li key={m.id}><button type="button" onClick={()=>{follow.current=false;document.getElementById(`ai-message-${m.id}`)?.scrollIntoView({block:'start',behavior:'instant'})}}>{m.question}</button></li>)}</ol></details>}
   <div className="zenix-ai-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Suhbat xabarlari">
    {messages.map(m=><article id={`ai-message-${m.id}`} key={m.id}><div className="zenix-ai-user-label">Siz</div><p className="zenix-ai-question">{m.question}</p><div className="zenix-ai-answer"><div className="zenix-ai-answer-label"><ZenixAIIcon/><strong>ZENIX AI</strong></div><p>{m.answer}</p>
     {aiMessageReports(m).map((report,reportIndex)=><section className="zenix-ai-report" key={reportIndex}><small>{report.from} — {report.to} · {report.storeId?'Tanlangan filial':'Barcha filiallar'}{report.sellerScoped?' · Faqat o‘z savdolaringiz':''}</small><div className="zenix-ai-facts">{report.facts?.map(f=><div key={f.id}><small>{f.label}</small><strong>{f.value===null?'Ma’lumot yetarli emas':`${f.value}${f.unit==='UZS'?' so‘m':f.unit==='count'?' ta':''}`}</strong></div>)}</div>
     {report.tables?.map((t,i)=><div className="zenix-ai-table" key={i}><table><caption>{t.title}</caption><thead><tr>{t.columns.map((col,j)=><th key={j}>{col}</th>)}</tr></thead><tbody>{t.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell??'Ma’lumot yetarli emas'}</td>)}</tr>)}</tbody></table>{!t.rows.length&&<p>Ushbu davrda mos ma’lumot topilmadi.</p>}</div>)}</section>)}
     {[...aiMessageReports(m).flatMap(report=>report.notes||[]),...(m.insights||[])].map((text,i)=><p className="zenix-ai-note" key={i}>{text}</p>)}
     {m.actions?.map(action=><ActionCard key={action.id} action={action} writesEnabled={status?.writesEnabled===true} onAction={runAction} now={now}/>)}
    </div></article>)}
    {busy&&<div className="zenix-ai-thinking" role="status"><ZenixAIIcon/><span>Biznes ma’lumotlari tekshirilmoqda…</span></div>}<div ref={bottom}/>
   </div>
   </div>
   {newReply&&<button className="zenix-ai-new-reply" type="button" onClick={()=>{follow.current=true;scroller.current.scrollTop=scroller.current.scrollHeight;setNewReply(false)}}>Yangi javobga o‘tish ↓</button>}
   {error&&<p role="alert" className="zenix-ai-error">{error}</p>}
   <form onSubmit={submit} className="zenix-ai-compose" aria-busy={busy}><label htmlFor="zenix-ai-question" className="zenix-ai-sr-only">Savolingiz</label><textarea ref={input} id="zenix-ai-question" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&!event.repeat){event.preventDefault();event.currentTarget.form.requestSubmit()}}} maxLength={1000} rows={2} disabled={busy||Boolean(blocked)||!status} placeholder="Biznesingiz haqida savol yoki buyruq yozing..." aria-describedby="zenix-ai-composer-help"/><div className="zenix-ai-compose-footer"><small id="zenix-ai-composer-help">Enter — yuborish <span>· Shift + Enter — yangi qator</span></small><button className="pro-btn primary" type="submit" aria-label={busy?'Tahlil qilinmoqda…':error?'Qayta urinish':'Yuborish'} title={error?'Qayta urinish':'Yuborish'} disabled={busy||Boolean(blocked)||!status||!question.trim()}><FiArrowUp aria-hidden="true"/><span className="zenix-ai-sr-only">{busy?'Tahlil qilinmoqda…':error?'Qayta urinish':'Yuborish'}</span></button></div></form>
   <small className="zenix-ai-safety"><FiShield aria-hidden="true"/>ZENIX AI amallarni bajarishdan oldin tasdiqlashingizni so‘raydi.</small>
  </div>
 </>;
}

export default function ZenixAI({open,mode='expanded',onModeChange,onClose}){
 const {currentUser}=useAuth(),{currentStoreId,stores}=useStore();
 const [scope,setScope]=useState(currentStoreId||''),[activated,setActivated]=useState(open);
 const panel=useRef(null),previousFocus=useRef(null);
 const [smallScreen,setSmallScreen]=useState(()=>window.innerWidth<=1280);
 const modal=open&&mode==='compact'&&smallScreen;
 useEffect(()=>{const resize=()=>{setSmallScreen(window.innerWidth<=1280);const viewport=window.visualViewport;if(panel.current)panel.current.dataset.keyboard=String(window.innerHeight-(viewport?.height||window.innerHeight)>80);panel.current?.style.setProperty('--ai-viewport-height',`${viewport?.height||window.innerHeight}px`);panel.current?.style.setProperty('--ai-keyboard-gap',`${Math.max(0,window.innerHeight-(viewport?.height||window.innerHeight)-(viewport?.offsetTop||0))}px`)};resize();window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize)}},[]);
 useEffect(()=>{if(!open)return;setActivated(true);previousFocus.current=document.activeElement;const frame=requestAnimationFrame(()=>panel.current?.querySelector('button:not(:disabled)')?.focus());return()=>{window.cancelAnimationFrame(frame);previousFocus.current?.isConnected&&previousFocus.current.focus()}},[open]);
 useEffect(()=>{if(!modal)return;const nodes=[...document.querySelectorAll('.header,main.content,.sidebar,.mobile-bottom-nav')],before=nodes.map(n=>n.inert);nodes.forEach(n=>{n.inert=true});const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{nodes.forEach((n,i)=>{n.inert=before[i]});document.body.style.overflow=overflow}},[modal]);
 const locked=['CASHIER','SALES','WAREHOUSE'].includes(currentUser?.appRole);
 return <aside id="zenix-ai-panel" className={`zenix-ai zenix-ai-panel zenix-ai-${mode==='expanded'?'workspace':'compact'}`} ref={panel} hidden={!open} role={mode==='expanded'?'main':modal?'dialog':'complementary'} aria-modal={modal||undefined} aria-label="ZENIX AI yordamchi" onKeyDown={event=>{
  if(!panel.current?.contains(event.target))return;
  event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose()}
  if(modal&&event.key==='Tab'){
   const elements=[...panel.current.querySelectorAll('button:not(:disabled),a[href],textarea:not(:disabled),summary,[tabindex="0"]')].filter(n=>n.getClientRects().length&&!n.closest('details:not([open]) :not(summary)'));
   const first=elements[0],last=elements.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
 }}>
  {activated&&<Chat key={scope} scope={scope} onScope={setScope} stores={stores} locked={locked} open={open} mode={mode} onModeChange={onModeChange} onClose={onClose}/>}
 </aside>;
}
