import { useMemo, useState } from "react";
import {
  FiActivity, FiArchive, FiBriefcase, FiCreditCard, FiDollarSign, FiPackage,
  FiRefreshCw, FiSearch, FiSettings, FiShoppingCart, FiTruck,
} from "react-icons/fi";
import { useStore } from "../../context/StoreContext";
import { ROLE_LABELS } from "../../config/roles";
import { formatWorkspaceDate, workspaceDateISO } from "../../utils/workspaceDate";
import { matchesStore, recordInPeriod } from "../../utils/reporting";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, ColumnPicker } from "../../components/Ui";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { formatAuditValue, normalizeActivityChanges } from "../../utils/auditChanges";
import "./activityLog.scss";

const filterTabs = [
  ["all", "Barchasi"], ["sale", "Savdo"], ["inventory", "Ombor"], ["transfer", "Transfer"],
  ["return", "Qaytarish"], ["expense", "Xarajat"], ["supplier", "Ta’minotchi"],
  ["product", "Mahsulot"], ["shift", "Smena"], ["billing", "To‘lov"], ["settings", "Sozlama"],
];

const typeConfig = {
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
  const { activityLogs, stores, effectiveWorkspaceSettings:workspaceSettings } = useStore();
  const [activeFilter, setActiveFilter] = useState("all");
  const [period, setPeriod] = useState("7");
  const [store, setStore] = useState("all");
  const [search, setSearch] = useState("");
  const {visible:activityDetails,toggle:toggleActivityDetail,show:showActivityDetail}=usePersistentColumns("zenix_activity_details",activityDetailDefs,{required:["time"]});
  const timezone = workspaceSettings.organization.timezone || "Asia/Tashkent";
  const todayKey = workspaceDateISO(new Date(), timezone);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...activityLogs]
      .filter((log) => matchesType(log.type, activeFilter))
      .filter((log) => recordInPeriod(log, period, { timezone }))
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
      <StatCard icon={FiActivity} label="Jami amallar" value={activityLogs.length} hint="Audit jurnalida" tone="blue"/>
      <StatCard icon={FiRefreshCw} label="Bugungi amallar" value={todayCount} hint={todayKey.split("-").reverse().join(".")} tone="green"/>
      <StatCard icon={FiCreditCard} label="Moliyaviy amallar" value={moneyCount} hint="Savdo, qaytarish, xarajat" tone="purple"/>
      <StatCard icon={FiArchive} label="Ombor amallari" value={stockCount} hint="Qoldiq, kirim, transfer" tone="orange"/>
    </div>

    <section className="pro-card activity-panel">
      <div className="activity-toolbar">
        <div className="pro-search"><FiSearch/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Amal, xodim yoki filial qidiring..."/></div>
        <PremiumSelect className="pro-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="1">Bugun</option><option value="7">7 kun</option><option value="30">30 kun</option><option value="all">Barcha davr</option></PremiumSelect>
        <PremiumSelect className="pro-select" value={store} onChange={(event) => setStore(event.target.value)}><option value="all">Barcha filiallar</option>{stores.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</PremiumSelect>
        <ColumnPicker columns={activityDetailDefs} visible={activityDetails} onToggle={toggleActivityDetail} label="Tafsilotlar" menuTitle="Ko‘rinadigan tafsilotlar"/>
      </div>

      <div className="activity-filters">{filterTabs.map(([value,label]) => <button className={activeFilter === value ? "active" : ""} key={value} onClick={() => setActiveFilter(value)} type="button">{label}</button>)}</div>

      <div className="activity-timeline">
        {filteredLogs.length === 0 ? <div className="activity-empty"><FiActivity/><h2>Amal topilmadi</h2><p>Filtrlarni o‘zgartiring yoki boshqa davrni tanlang.</p></div> : filteredLogs.map((log) => {
          const [label,tone] = typeConfig[log.type] || ["Amal", "neutral"];
          return <div className="activity-log-item" key={log.id}>
            <div className={`activity-node ${log.type}`}>{getLogIcon(log.type)}</div>
            <div className="activity-log-card">
              <div className="activity-log-top"><div><h3>{log.title}</h3><p>{log.description || "Tafsilot kiritilmagan."}</p></div><StatusBadge tone={tone}>{label}</StatusBadge></div>
              {showActivityDetail("change")&&(()=>{const rows=normalizeActivityChanges(log.changes);if(rows.some(change=>change.before!=null||change.after!=null))return <div className="activity-change-list">{rows.map((change,index)=><div className="activity-change-row" key={`${change.field}-${index}`}><b>{change.label}</b><span>{formatAuditValue(change.before)}</span><i>→</i><strong>{formatAuditValue(change.after)}</strong></div>)}</div>;if(log.before!=null||log.after!=null)return <div className="activity-change"><span>{formatAuditValue(log.before)}</span><i>→</i><strong>{formatAuditValue(log.after)}</strong></div>;return null})()}
              <div className="activity-log-meta">
                {showActivityDetail("user")&&<span><strong>{log.userName || "Foydalanuvchi"}</strong> · {roleLabel(log.userRole)}</span>}
                {showActivityDetail("store")&&<span>{log.storeName || stores.find((item) => item.id === log.storeId)?.name || "Barcha filiallar"}</span>}
                {showActivityDetail("time")&&<span>{log.createdAt ? formatWorkspaceDate(log.createdAt, workspaceSettings.organization, { withTime:true }) : `${log.date || ""} ${log.time || ""}`}</span>}
              </div>
            </div>
          </div>;
        })}
      </div>
    </section>
  </div>;
}

export default ActivityLog;
