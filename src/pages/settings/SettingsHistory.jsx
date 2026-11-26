import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {FiClock,FiSearch,FiSettings,FiRefreshCw} from "react-icons/fi";
import {api} from "../../services/apiClient";
import {PremiumDateInput} from "../../components/Ui";
import {formatWorkspaceDate} from "../../utils/workspaceDate";
import {settingsAuditQuery} from "./settingsNavigation";
export default function SettingsHistory({allowed,organization}){
 const [query,setQuery]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[page,setPage]=useState(0),[refresh,setRefresh]=useState(0);
 const [result,setResult]=useState({items:[],hasMore:false}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const invalidRange=Boolean(from&&to&&from>to);
 useEffect(()=>{
  if(!allowed||invalidRange)return;
  const controller=new AbortController();
  setLoading(true);setError("");setResult({items:[],hasMore:false});
  const timer=setTimeout(()=>{
   api.get("/api/audit?"+settingsAuditQuery({query,page,from,to}),{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setResult({items:Array.isArray(data?.items)?data.items.filter(item=>item.type==="settings"):[],hasMore:data?.hasMore===true})}).catch(e=>{if(!controller.signal.aborted)setError(e.message||"Audit tarixini yuklab bo‘lmadi")}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  },180);
  return()=>{clearTimeout(timer);controller.abort()};
 },[allowed,query,from,to,page,refresh,invalidRange]);
 const change=setter=>e=>{setter(e.target.value);setPage(0)};
 if(!allowed)return <div className="pro-empty"><FiClock/><strong>Audit tarixiga ruxsat yo‘q</strong><span>Tashkilot egasidan faoliyat jurnali ruxsatini so‘rang.</span></div>;
 return <>
  <div className="pro-card-head"><div><h2>Sozlamalar tarixi</h2><p>Serverda qayd etilgan sozlama o‘zgarishlari.</p></div><Link className="pro-btn secondary" to="/activity-log">Faoliyat jurnali</Link></div>
  <div className="pro-toolbar"><div className="pro-search"><FiSearch/><input aria-label="Sozlamalar tarixini qidirish" maxLength={100} value={query} onChange={change(setQuery)} placeholder="O‘zgarish yoki xodim..."/></div><button type="button" className="pro-btn secondary" disabled={loading&&!invalidRange} onClick={()=>setRefresh(n=>n+1)}><FiRefreshCw/> Yangilash</button></div>
  <div className="pro-form-grid"><label className="pro-field"><span>Boshlanish sanasi</span><PremiumDateInput value={from} onChange={change(setFrom)}/></label><label className="pro-field"><span>Yakuniy sana</span><PremiumDateInput value={to} onChange={change(setTo)}/></label></div>
  {invalidRange?<p role="alert">Boshlanish sanasi yakuniy sanadan keyin bo‘lmasligi kerak.</p>:error?<p role="alert" className="pro-alert danger">{error}</p>:loading?<p role="status">Audit tarixi yuklanmoqda...</p>:result.items.length?<div className="settings-history-list">{result.items.map(item=><article key={item.id}><div className="settings-history-icon"><FiSettings/></div><span><strong>{item.title}</strong><small>{item.description}</small><small>{[item.userName,item.storeName].filter(Boolean).join(" · ")||"—"}</small></span><time dateTime={item.createdAt}>{formatWorkspaceDate(item.createdAt,organization,{withTime:true})}</time></article>)}</div>:<div className="pro-empty"><FiClock/><strong>Yozuv topilmadi</strong><span>Qidiruv yoki sana filtrini o‘zgartiring.</span></div>}
  {!invalidRange&&!error&&<nav className="platform-pagination" aria-label="Sozlamalar audit sahifasi"><span>{page+1}-sahifa</span><div><button type="button" className="pro-btn secondary" disabled={loading||page===0} onClick={()=>setPage(n=>Math.max(0,n-1))}>Oldingi</button><button type="button" className="pro-btn secondary" disabled={loading||!result.hasMore} onClick={()=>setPage(n=>n+1)}>Keyingi</button></div></nav>}
 </>;
}
