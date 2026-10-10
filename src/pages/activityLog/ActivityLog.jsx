import {api} from "../../services/apiClient";
import { useEffect, useMemo, useState } from "react";
import {
  FiActivity, FiArchive, FiBriefcase, FiCreditCard, FiDollarSign, FiPackage,
  FiRefreshCw, FiSearch, FiSettings, FiShoppingCart, FiTruck,
} from "react-icons/fi";
import { useStore } from "../../context/StoreContext";
import { ROLE_LABELS } from "../../config/roles";
import { formatWorkspaceDate, workspaceDateISO } from "../../utils/workspaceDate";
import { matchesStore, recordInPeriod } from "../../utils/reporting";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, PremiumDateInput, ColumnPicker } from "../../components/Ui";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { hasAuditValue, formatAuditValue, normalizeActivityChanges } from "../../utils/auditChanges";
import "./activityLog.scss";

const filterTabs = [
  ["all", "Barchasi"], ["sale", "Savdo"], ["inventory", "Ombor"], ["transfer", "Transfer"],
  ["return", "Qaytarish"], ["expense", "Xarajat"], ["supplier", "Ta’minotchi"],
  ["product", "Mahsulot"], ["shift", "Smena"], ["billing", "To‘lov"], ["settings", "Sozlama"],
];

const typeConfig = {
  customer:["Mijoz","info"],customer_payment:["Nasiya tolov","success"],
  product: ["Mahsulot", "info"], price: ["Narx", "info"],
  inventory: ["Ombor", "warning"], stock: ["Qoldiq", "warning"], transfer: ["Transfer", "warning"],
  sale: ["Savdo", "success"], return: ["Qaytarish", "danger"], expense: ["Xarajat", "danger"],
  supplier: ["Ta’minotchi", "neutral"], shift: ["Smena", "neutral"], billing: ["To‘lov", "info"], settings: ["Sozlama", "neutral"],
};

const matchesType = (type, filter) => {
  if (filter === "all") return true;
  if (filter === "product") return ["product", "price"].includes(type);
  if (filter === "inventory") return ["inventory", "stock"].includes(type);
  return type === filter;
};

const roleLabel = (value) => ROLE_LABELS[value] || ({ admin:"Administrator", cashier:"Kassir", manager:"Menejer", owner:"Egasi", sales:"Sotuvchi", warehouse:"Omborchi", platform_admin:"Platforma administratori" }[String(value || "").toLowerCase()] || value || "Foydalanuvchi");

const activityDetailDefs=[
  {id:"change",label:"O‘zgarish"},
  {id:"user",label:"Xodim va rol"},
  {id:"store",label:"Filial"},
  {id:"time",label:"Sana va vaqt"},
];

function ActivityLog() {
  const { stores, effectiveWorkspaceSettings:workspaceSettings } = useStore();
  const [activityLogs,setActivityLogs]=useState([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [period, setPeriod] = useState("7");
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  const [store, setStore] = useState("all");
  const [search, setSearch] = useState("");
  const {visible:activityDetails,toggle:toggleActivityDetail,show:showActivityDetail}=usePersistentColumns("zenix_activity_details",activityDetailDefs,{required:["time"]});
  const timezone = workspaceSettings.organization.timezone || "Asia/Tashkent";
  const todayKey = workspaceDateISO(new Date(), timezone);

  useEffect(()=>setOffset(0),[activeFilter,period,store,search,from,to]);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");const params=new URLSearchParams({type:activeFilter,q:search.slice(0,100),limit:"50",offset:String(offset)});if(store!=="all")params.set("storeId",store);if(period==="custom"){if(from)params.set("from",from);if(to)params.set("to",to);}else if(period!=="all"){const from=new Date();from.setDate(from.getDate()-(Number(period)-1));params.set("from",workspaceDateISO(from,timezone));}api.get(`/api/audit?${params}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setActivityLogs(data.items||[]);setHasMore(Boolean(data.hasMore));}}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setActivityLogs([]);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[activeFilter,period,store,search,from,to,offset,timezone]);
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...activityLogs]
      .filter((log) => matchesType(log.type, activeFilter))
      .filter((log) => recordInPeriod(log, period==="custom"?"all":period, { timezone }))
      .filter((log) => matchesStore(log, store, stores))
      .filter((log) => !query || `${log.title || ""} ${log.description || ""} ${log.userName || ""} ${log.storeName || ""}`.toLowerCase().includes(query))
      .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [activityLogs, activeFilter, period, timezone, store, stores, search]);

  const todayCount = activityLogs.filter((log) => workspaceDateISO(log.createdAt || new Date(), timezone) === todayKey).length;
  const moneyCount = activityLogs.filter((log) => ["sale", "return", "expense", "billing"].includes(log.type)).length;
  const stockCount = activityLogs.filter((log) => ["inventory", "stock", "transfer", "product", "price"].includes(log.type)).length;

  const getLogIcon = (type) => {
    if (type === "supplier") return <FiTruck/>;
    if (["inventory","stock","transfer"].includes(type)) return <FiArchive/>;
    if (type === "price") return <FiDollarSign/>;
    if (["sale","return"].includes(type)) return <FiShoppingCart/>;
    if (type === "expense" || type === "billing") return <FiCreditCard/>;
    if (type === "shift") return <FiBriefcase/>;
    if (type === "settings") return <FiSettings/>;
    return <FiPackage/>;
  };

  return <div className="pro-page activity-log-page">
    <PageHeader title="Amallar tarixi" subtitle="Kim, qachon va qaysi filialda muhim o‘zgarish qilganini kuzating."/>

    <div className="pro-stat-grid activity-summary">
      <StatCard icon={FiActivity} label="Yuklangan amallar" value={activityLogs.length} hint="Joriy audit sahifasi" tone="blue"/>
      <StatCard icon={FiRefreshCw} label="Bugungi amallar" value={todayCount} hint={todayKey.split("-").reverse().join(".")} tone="green"/>
      <StatCard icon={FiCreditCard} label="Moliyaviy amallar" value={moneyCount} hint="Savdo, qaytarish, xarajat" tone="purple"/>
      <StatCard icon={FiArchive} label="Ombor amallari" value={stockCount} hint="Qoldiq, kirim, transfer" tone="orange"/>
    </div>

    <section className="pro-card activity-panel">
      <div className="activity-toolbar">
        <div className="pro-search"><FiSearch/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Amal, xodim yoki filial qidiring..."/></div>
        <PremiumSelect className="pro-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="1">Bugun</option><option value="7">7 kun</option><option value="30">30 kun</option><option value="all">Barcha davr</option><option value="custom">Sana oraligi</option></PremiumSelect>
        <PremiumDateInput aria-label="Audit boshlanish sanasi" value={from} onChange={event=>{setFrom(event.target.value);setPeriod('custom')}}/>
        <PremiumDateInput aria-label="Audit tugash sanasi" value={to} onChange={event=>{setTo(event.target.value);setPeriod('custom')}}/>
        <PremiumSelect className="pro-select" value={store} onChange={(event) => setStore(event.target.value)}><option value="all">Barcha filiallar</option>{stores.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</PremiumSelect>
        <ColumnPicker columns={activityDetailDefs} visible={activityDetails} onToggle={toggleActivityDetail} label="Tafsilotlar" menuTitle="Ko‘rinadigan tafsilotlar"/>
      </div>

      <div className="activity-filters">{filterTabs.map(([value,label]) => <button className={activeFilter === value ? "active" : ""} key={value} onClick={() => setActiveFilter(value)} type="button">{label}</button>)}</div>

      {loading&&<div className="pro-empty">Yuklanmoqda...</div>}{error&&<div className="pro-alert danger">{error}</div>}<div className="activity-timeline">
        {loading?null:filteredLogs.length === 0 ? <div className="activity-empty"><FiActivity/><h2>Amal topilmadi</h2><p>Filtrlarni o‘zgartiring yoki boshqa davrni tanlang.</p></div> : filteredLogs.map((log) => {
          const [label,tone] = typeConfig[log.type] || ["Amal", "neutral"];
          return <div className="activity-log-item" key={log.id}>
            <div className={`activity-node ${log.type}`}>{getLogIcon(log.type)}</div>
            <div className="activity-log-card">
              <div className="activity-log-top"><div><h3>{log.title}</h3><p>{log.description || "Tafsilot kiritilmagan."}</p></div><StatusBadge tone={tone}>{label}</StatusBadge></div>
              {showActivityDetail("change")&&(()=>{const rows=normalizeActivityChanges(log.changes);if(rows.some(change=>hasAuditValue(change.before)||hasAuditValue(change.after)))return <div className="activity-change-list">{rows.map((change,index)=><div className="activity-change-row" key={`${change.field}-${index}`}><b>{change.label}</b><span>{formatAuditValue(change.before)}</span><i>→</i><strong>{formatAuditValue(change.after)}</strong></div>)}</div>;if(hasAuditValue(log.before)||hasAuditValue(log.after))return <div className="activity-change"><span>{formatAuditValue(log.before)}</span><i>→</i><strong>{formatAuditValue(log.after)}</strong></div>;return null})()}
              {log.metadata?.tracking?.batches?.length>0&&<div className="activity-change-list">{log.metadata.tracking.batches.map(batch=><div className="activity-change-row" key={batch.id}><b>Partiya {batch.id}</b><span>{batch.before}</span><i>→</i><strong>{batch.after}{batch.origin==='UNKNOWN'?' · Kelib chiqishi nomaʼlum':''}</strong></div>)}</div>}
              <div className="activity-log-meta">
                {showActivityDetail("user")&&<span><strong>{log.userName || "Foydalanuvchi"}</strong> · {roleLabel(log.userRole)}</span>}
                {showActivityDetail("store")&&<span>{log.storeName || stores.find((item) => item.id === log.storeId)?.name || "Barcha filiallar"}</span>}
                {showActivityDetail("time")&&<span>{log.createdAt ? formatWorkspaceDate(log.createdAt, workspaceSettings.organization, { withTime:true }) : `${log.date || ""} ${log.time || ""}`}</span>}
              </div>
            </div>
          </div>;
        })}
      </div>
    <nav className="platform-pagination" aria-label="Audit sahifasi"><span>{offset+activityLogs.length} ta yozuv yuklandi</span><div><button className="pro-btn secondary" disabled={loading||offset===0} onClick={()=>setOffset(value=>Math.max(0,value-50))}>Oldingi</button><button className="pro-btn secondary" disabled={loading||!hasMore} onClick={()=>setOffset(value=>value+50)}>Keyingi</button></div></nav></section>
  </div>;
}

export default ActivityLog;
