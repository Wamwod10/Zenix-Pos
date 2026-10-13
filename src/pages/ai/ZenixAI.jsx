import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../../services/apiClient';
import {useStore} from '../../context/StoreContext';
import {useAuth} from '../../context/AuthContext';
import {PageHeader,PremiumSelect} from '../../components/Ui';
import './zenixAi.scss';

export default function ZenixAI(){
 const {currentUser}=useAuth(),{currentStoreId,stores,hasPermission}=useStore();
 const [status,setStatus]=useState(null),[question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[scope,setScope]=useState(currentStoreId||'');
 const controller=useRef(null),mounted=useRef(true),retry=useRef(null),sending=useRef(false),bottom=useRef(null);
 const refresh=useCallback(async signal=>{const data=await api.get('/api/ai/status',{signal});if(mounted.current)setStatus(data)},[]);
 useEffect(()=>{mounted.current=true;const c=new AbortController();refresh(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>{mounted.current=false;c.abort();controller.current?.abort()}},[refresh]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'})},[messages,busy]);
 const locked=['CASHIER','SALES','WAREHOUSE'].includes(currentUser?.appRole),canBill=hasPermission('moduleBilling',currentUser?.appRole);
 const blocked=status&&!status.limit?'ZENIX AI Business va Premium tariflarida mavjud.':status&&!status.writable?'Obuna muddati tugagan. Ma’lumotlaringiz saqlangan; AI uchun tarifni faollashtiring.':status&&!status.enabled?'ZENIX AI ulanishi hali faollashtirilmagan. POS modullaridan foydalanishda davom etishingiz mumkin.':status&&status.remaining<=0?'Oylik AI so‘rovlari tugagan. POS modullari ishlashda davom etadi.':'';
 async function submit(event){
  event.preventDefault();const text=question.trim();if(!text||busy||sending.current||blocked||!status)return;
  sending.current=true;setBusy(true);setError('');const body=retry.current?.question===text&&retry.current?.storeId===(scope||null)?retry.current:{requestId:crypto.randomUUID(),question:text,storeId:scope||null};retry.current=body;
  const c=new AbortController();controller.current=c;const timer=setTimeout(()=>c.abort(),25000);
  try{
   const response=await api.post('/api/ai/chat',body,{signal:c.signal});
   if(mounted.current){setMessages(old=>[...old.slice(-18),{id:body.requestId,question:text,...response}]);setQuestion('');retry.current=null}
  }catch(e){if(mounted.current){setError(e.message||'AI javobini olib bo‘lmadi. Qayta urining.');if(e.status&&e.code!=='AI_REQUEST_PENDING')retry.current=null}}
  finally{clearTimeout(timer);sending.current=false;if(mounted.current){setBusy(false);refresh().catch(()=>{})}}
 }
 return <section className="zenix-ai">
  <PageHeader title="ZENIX AI" subtitle="Ruxsat berilgan biznes ma’lumotlari asosida yordamchi"/>
  <div className="pro-card zenix-ai-summary">
   <div><strong>{status?.planCode||'Joriy tarif'}</strong><p>{status?`${status.remaining} / ${status.limit} ta so‘rov qoldi`:'AI holati yuklanmoqda…'}</p><small>{status&&`Limit yangilanishi: ${new Date(status.resetsAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})} (Toshkent)`}</small></div>
   {!locked&&<PremiumSelect value={scope} disabled={busy} onChange={event=>{setScope(event.target.value);retry.current=null;setMessages([])}} aria-label="AI filial doirasi"><option value="">Barcha filiallar</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</PremiumSelect>}
   {canBill&&<Link className="pro-btn" to="/billing">Tarif va to‘lovlar</Link>}
  </div>
  {blocked&&<div className="pro-card zenix-ai-notice" role="status"><p>{blocked}</p>{canBill&&(!status.limit||status.remaining<=0)&&<Link className="pro-btn primary" to="/billing">Tarifni oshirish</Link>}</div>}
  <div className="pro-card zenix-ai-chat">
   <div className="zenix-ai-suggestions" aria-label="Tavsiya etilgan savollar">{status?.suggestions?.map(s=><button type="button" className="pro-btn" key={s.topic} disabled={busy||Boolean(blocked)} onClick={()=>setQuestion(s.question)}>{s.question}</button>)}</div>
   <div className="zenix-ai-messages" aria-live="polite" aria-relevant="additions">
    {!messages.length&&<div className="pro-empty"><strong>Biznesingiz haqida savol bering</strong><span>Bugungi savdo, qoldiq va ruxsat berilgan hisobotlarni tahlil qiling. Har bir savol mustaqil tahlil qilinadi.</span></div>}
    {messages.map(m=><article key={m.id}><p className="zenix-ai-question">{m.question}</p><div className="zenix-ai-answer"><strong>ZENIX AI</strong><p>{m.answer}</p><small>{m.report.from} — {m.report.to} · {m.report.storeId?'Tanlangan filial':'Barcha filiallar'}{m.report.sellerScoped?' · Faqat o‘z savdolaringiz':''}</small>
     <div className="zenix-ai-facts">{m.report.facts.map(f=><div key={f.id}><small>{f.label}</small><strong>{f.value===null?'Ma’lumot yetarli emas':`${f.value}${f.unit==='UZS'?' so‘m':f.unit==='count'?' ta':''}`}</strong></div>)}</div>
     {m.report.tables.map((t,i)=><div className="zenix-ai-table" key={i}><table><caption>{t.title}</caption><thead><tr>{t.columns.map((col,j)=><th key={j}>{col}</th>)}</tr></thead><tbody>{t.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell??'Ma’lumot yetarli emas'}</td>)}</tr>)}</tbody></table>{!t.rows.length&&<p>Ushbu davrda mos ma’lumot topilmadi.</p>}</div>)}
     {[...m.report.notes,...m.insights].map((text,i)=><p className="zenix-ai-note" key={i}>{text}</p>)}</div></article>)}
    {busy&&<p role="status">Biznes ko‘rsatkichlari tahlil qilinmoqda…</p>}<div ref={bottom}/>
   </div>
   {error&&<p role="alert" className="zenix-ai-error">{error}</p>}
   <form onSubmit={submit} className="zenix-ai-compose"><label htmlFor="zenix-ai-question">Savolingiz</label><textarea id="zenix-ai-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} rows={3} disabled={busy||Boolean(blocked)} placeholder="Bugun qancha savdo bo‘ldi?"/><button className="pro-btn primary" type="submit" disabled={busy||Boolean(blocked)||!status||!question.trim()}>{busy?'Tahlil qilinmoqda…':'Yuborish'}</button></form>
   <small>AI ma’lumotlarni o‘zgartirmaydi. Tavsiyalarni biznes qaroridan oldin tekshiring.</small>
  </div>
 </section>;
}
