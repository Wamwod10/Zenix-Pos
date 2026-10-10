import {financialSalesEvents} from "../../utils/reporting";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { FiAward, FiCreditCard, FiSearch, FiShoppingCart, FiTrendingUp, FiUserCheck } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import useScopedReport, {reportSales} from "../../utils/useScopedReport";
import { ROLES } from "../../config/roles";
import { formatPrice } from "../../utils/formatPrice";
import { buildSellerAnalyticsRows, matchesStore, recordInPeriod,periodRange } from "../../utils/reporting";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, ColumnPicker } from "../../components/Ui";
import Modal from "../../components/Modal";
import usePersistentColumns from "../../utils/usePersistentColumns";
import ResponsiveChart from "../../components/ResponsiveChart";
import "./sellerAnalytics.scss";

function SellerAnalytics() {
  const { currentUser } = useAuth();
  const { returns:bootstrapReturns, shiftHistory, stores, employees, effectiveWorkspaceSettings:workspaceSettings } = useStore();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30");
  const [store, setStore] = useState("all");
  const [selected, setSelected] = useState(null);
  const sellerColumnDefs = [{id:"sales",label:"Sof savdo"},{id:"profit",label:"Foyda"},{id:"count",label:"Tranzaksiya"},{id:"avg",label:"O‘rtacha chek"},{id:"discount",label:"Chegirma"},{id:"returns",label:"Qaytarish"},{id:"shifts",label:"Smena"}];
  const { visible:sellerColumns, toggle:toggleSellerColumn, show:showSellerColumn } = usePersistentColumns("zenix_seller_analytics_columns", sellerColumnDefs);
  const isCashier = currentUser?.appRole === ROLES.CASHIER;
  const timezone = workspaceSettings.organization.timezone || "Asia/Tashkent";
  const currentIdentityIds=[currentUser?.employeeId,currentUser?.id].filter(Boolean).map(String);
  const isOwnSale=(sale)=>{
    const identity=sale?.sellerId||sale?.sellerAccountId;
    return identity?currentIdentityIds.includes(String(identity)):(sale?.sellerName||sale?.seller)===currentUser?.name;
  };

  const range=periodRange(period,{timezone,businessDay:workspaceSettings.businessDay});
  const report=useScopedReport({storeId:store,from:range.from,to:range.to},{allPages:true,revision:bootstrapReturns[0]?.id});
  const {returns}=report;
  const saleRecords=useMemo(()=>reportSales(report),[report.sales,returns]);

  const allSales=useMemo(()=>financialSalesEvents(saleRecords,returns),[saleRecords,returns]);
  const filteredSales = useMemo(() => allSales.filter((sale) => {
    if (!recordInPeriod(sale, period, { timezone, businessDay:workspaceSettings.businessDay })) return false;
    if (!matchesStore(sale, store, stores)) return false;
    if (isCashier && !isOwnSale(sale)) return false;
    return true;
  }), [allSales, period, timezone, store, stores, isCashier, currentUser?.name]);

  const sellers = useMemo(() => {
    const visibleEmployees=isCashier?employees.filter((employee)=>{
      const identity=employee?.id||employee?.accountId;
      return identity?currentIdentityIds.includes(String(identity)):employee?.name===currentUser?.name;
    }):employees;
    return buildSellerAnalyticsRows({
      employees:visibleEmployees,sales:filteredSales,shiftHistory,period,timezone,
      businessDay:workspaceSettings.businessDay,store,stores,
    });
  }, [employees, filteredSales, shiftHistory, period, timezone, store, stores, isCashier, currentUser?.id, currentUser?.employeeId, currentUser?.name, workspaceSettings.businessDay]);

  const visible = sellers.filter((sellerRow) => sellerRow.name.toLowerCase().includes(search.toLowerCase()));
  const totalSales = !search&&report.aggregate?report.aggregate.netRevenue:visible.reduce((sum, row) => sum + row.sales, 0);
  const totalProfit = !search&&report.aggregate?report.aggregate.grossProfit:visible.reduce((sum, row) => sum + row.profit, 0);
  const totalCount = !search&&report.aggregate?report.aggregate.saleCount:visible.reduce((sum, row) => sum + row.count, 0);
  const avgCheck = totalCount ? totalSales / totalCount : 0;
  const top = visible[0];
  const chart = visible.slice(0, 7).map((row) => ({ name: row.name.split(" ")[0], sales: row.sales, profit: row.profit }));
  const periodLabel = period === "month" ? "Bu oy" : period === "all" ? "Barcha davr" : `${period} kun`;
  const storeLabel = store === "all" ? "Barcha filiallar" : stores.find((item) => item.id === store)?.name || "Filial";

  return <div className="pro-page seller-pro">
    {report.error&&<div className="pro-alert danger" role="alert">{report.error}</div>}
    {report.loading&&<div className="pro-alert" role="status">Hisobot yuklanmoqda…</div>}
    <PageHeader
      title={isCashier ? "Mening natijalarim" : "Sotuvchi tahlili"}
      subtitle={isCashier ? "Savdo, foyda, o‘rtacha chek va qaytarish ko‘rsatkichlaringiz." : "Sotuvchilar natijalarini bir xil davr va filial kesimida taqqoslang."}
    />

    <section className="seller-filterbar pro-card">
      {!isCashier && <div className="pro-search"><FiSearch/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sotuvchi qidirish..."/></div>}
      <PremiumSelect className="pro-select" value={period} onChange={(event) => setPeriod(event.target.value)}>
        <option value="7">7 kun</option><option value="30">30 kun</option><option value="month">Bu oy</option><option value="all">Barcha davr</option>
      </PremiumSelect>
      {!isCashier && <PremiumSelect className="pro-select" value={store} onChange={(event) => setStore(event.target.value)}>
        <option value="all">Barcha filiallar</option>{stores.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </PremiumSelect>}
    </section>

    <div className="pro-stat-grid">
      <StatCard icon={FiShoppingCart} label="Sof savdo" value={formatPrice(totalSales)} hint={`${totalCount} ta tranzaksiya`} tone="blue"/>
      <StatCard icon={FiTrendingUp} label="Yalpi foyda" value={formatPrice(totalProfit)} hint={`${periodLabel} · ${storeLabel}`} tone="green"/>
      <StatCard icon={FiCreditCard} label="O‘rtacha chek" value={formatPrice(avgCheck)} hint="Sof savdo bo‘yicha" tone="purple"/>
      <StatCard icon={FiAward} label={isCashier ? "Qaytarish" : "Eng yuqori savdo"} value={isCashier ? formatPrice(top?.returnAmount || 0) : top?.name || "—"} hint={isCashier ? `${top?.returnRate?.toFixed(1) || "0.0"}% qaytarish darajasi` : top ? formatPrice(top.sales) : "Ma’lumot yo‘q"} tone="orange"/>
    </div>

    <div className="seller-layout">
      <section className="pro-card seller-chart-card">
        <div className="pro-card-head"><div><h2>Savdo va foyda</h2><p>{periodLabel} · {storeLabel}</p></div></div>
        <div className="seller-chart">{chart.length ? <ResponsiveChart><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:9}} tickFormatter={(value) => `${Math.round(value / 1000)}k`}/><Tooltip formatter={(value) => formatPrice(value)}/><Bar dataKey="sales" name="Sof savdo" fill="var(--primary)" radius={[7,7,0,0]}/><Bar dataKey="profit" name="Yalpi foyda" fill="#16a34a" radius={[7,7,0,0]}/></BarChart></ResponsiveChart> : <div className="pro-empty">Tanlangan davrda savdo yo‘q</div>}</div>
      </section>

      {!isCashier && <section className="pro-card leaderboard">
        <div className="pro-card-head"><div><h2>Sotuvchilar</h2><p>Sof savdo bo‘yicha tartiblangan</p></div></div>
        {visible.length ? visible.map((row, index) => <button key={row.id} onClick={() => setSelected(row)}><b className={index < 3 ? `rank-${index + 1}` : ""}>{index + 1}</b><span><strong>{row.name}</strong><small>{row.count} savdo · o‘rtacha {formatPrice(row.avg)}</small></span><em>{formatPrice(row.sales)}</em></button>) : <div className="pro-empty"><FiUserCheck/><strong>Sotuvchi topilmadi</strong></div>}
      </section>}
    </div>

    <section className="pro-card seller-table-card">
      <div className="pro-card-head"><div><h2>Batafsil ko‘rsatkichlar</h2><p>Sof savdo, foyda, chegirma va qaytarish bir joyda.</p></div><ColumnPicker columns={sellerColumnDefs} visible={sellerColumns} onToggle={toggleSellerColumn}/></div>
      <div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Sotuvchi</th>{showSellerColumn("sales")&&<th>Sof savdo</th>}{showSellerColumn("profit")&&<th>Foyda</th>}{showSellerColumn("count")&&<th>Tranzaksiya</th>}{showSellerColumn("avg")&&<th>O‘rtacha chek</th>}{showSellerColumn("discount")&&<th>Chegirma</th>}{showSellerColumn("returns")&&<th>Qaytarish</th>}{showSellerColumn("shifts")&&<th>Smena</th>}</tr></thead><tbody>
        {visible.length ? visible.map((row) => <tr key={row.id} onClick={() => setSelected(row)} className="clickable-row"><td data-label="Sotuvchi"><strong>{row.name}</strong></td>{showSellerColumn("sales")&&<td data-label="Sof savdo">{formatPrice(row.sales)}</td>}{showSellerColumn("profit")&&<td data-label="Foyda">{formatPrice(row.profit)}</td>}{showSellerColumn("count")&&<td data-label="Tranzaksiya">{row.count}</td>}{showSellerColumn("avg")&&<td data-label="O‘rtacha chek">{formatPrice(row.avg)}</td>}{showSellerColumn("discount")&&<td data-label="Chegirma">{formatPrice(row.discount)}</td>}{showSellerColumn("returns")&&<td data-label="Qaytarish"><StatusBadge tone={row.returnRate <= 3 ? "success" : row.returnRate <= 8 ? "warning" : "danger"}>{row.returnRate.toFixed(1)}%</StatusBadge></td>}{showSellerColumn("shifts")&&<td data-label="Smena">{row.shifts}</td>}</tr>) : <tr><td colSpan={sellerColumns.length+1}><div className="pro-empty">Ma’lumot topilmadi</div></td></tr>}
      </tbody></table></div>
    </section>

    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "Sotuvchi"} subtitle={`${periodLabel} · ${storeLabel}`} size="lg">
      <div className="seller-detail-grid">{selected && [
        ["Sof savdo", formatPrice(selected.sales)], ["Yalpi foyda", formatPrice(selected.profit)], ["O‘rtacha chek", formatPrice(selected.avg)],
        ["Qaytarish", `${formatPrice(selected.returnAmount)} · ${selected.returnRate.toFixed(1)}%`], ["Chegirma", formatPrice(selected.discount)], ["Smenalar", selected.shifts],
      ].map(([key,value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>
      <div className="seller-payment-mix"><h3>To‘lovlar</h3>{selected && [["Naqd",selected.cash],["Karta",selected.card],["O‘tkazma",selected.transfer]].map(([key,value]) => <div key={key}><span>{key}</span><div><i style={{width:`${selected.sales ? Math.round(value / selected.sales * 100) : 0}%`}}/></div><b>{formatPrice(value)}</b></div>)}</div>
      <h3 className="detail-subtitle">Eng ko‘p sotilgan mahsulotlar</h3><div className="rank-list">{selected && Object.entries(selected.products).sort((a,b) => b[1] - a[1]).slice(0,6).map(([name,qty],index) => <div key={name}><b>{index + 1}</b><span><strong>{name}</strong><small>{qty} dona</small></span></div>)}</div>
    </Modal>
  </div>;
}

export default SellerAnalytics;
