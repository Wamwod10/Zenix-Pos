import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { FiBarChart2, FiCreditCard, FiDollarSign, FiDownload, FiPackage, FiRefreshCw, FiShoppingCart, FiTrendingUp } from "react-icons/fi";
import { useStore } from "../../context/StoreContext";
import useScopedReport, {reportSales} from "../../utils/useScopedReport";
import { formatPrice } from "../../utils/formatPrice";
import { workspaceDateISO } from "../../utils/workspaceDate";
import {
  financialSalesEvents, matchesStore, projectInventoryScope, recordDateKey, recordInPeriod, recordInRange, periodRange, previousPeriodRange, returnedAmountForSale,
  saleNetPaymentBreakdown, saleNetProfit, saleNetRevenue, scopedSale,
} from "../../utils/reporting";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, PremiumDateInput } from "../../components/Ui";
import ResponsiveChart from "../../components/ResponsiveChart";
import "./analytics.scss";

const presets = ["Bugun", "7 kun", "30 kun", "Bu oy", "Ixtiyoriy"];

function Analytics() {
  const { returns:bootstrapReturns, inventoryState, stores, effectiveWorkspaceSettings:workspaceSettings } = useStore();
  const [period, setPeriod] = useState("30 kun");
  const [store, setStore] = useState("all");
  const [category, setCategory] = useState("all");
  const [seller, setSeller] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const timezone = workspaceSettings.organization.timezone || "Asia/Tashkent";
  const periodOptions = { from, to, timezone, businessDay:workspaceSettings.businessDay };
  const periodKey=period==='Ixtiyoriy'?'Custom':period;

  const currentRange=periodRange(periodKey,periodOptions),earlierRange=previousPeriodRange(periodKey,periodOptions);
  const report=useScopedReport({storeId:store,from:earlierRange?.from||currentRange.from,to:currentRange.to,sellerId:seller},{allPages:true,revision:bootstrapReturns[0]?.id});
  const summary=useScopedReport({storeId:store,from:currentRange.from,to:currentRange.to,sellerId:seller,limit:1},{revision:bootstrapReturns[0]?.id});
  const {returns,expenses}=report;
  const saleRecords=useMemo(()=>reportSales(report),[report.sales,returns]);

  const allSales=useMemo(()=>financialSalesEvents(saleRecords,returns),[saleRecords,returns]);
  const productById = useMemo(() => new Map(inventoryState.map((product) => [String(product.id), product])), [inventoryState]);
  const sellerIdentity = (sale) => String(sale?.sellerId || sale?.sellerAccountId || sale?.sellerName || sale?.seller || "");
  const sellers = useMemo(() => {
    const map = new Map();
    allSales.forEach((sale) => {
      const id = sellerIdentity(sale);
      if (!id) return;
      if (!map.has(id)) map.set(id, { id, name:sale.sellerName || sale.seller || "Sotuvchi" });
    });
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [allSales]);
  const categories = useMemo(() => [...new Set(inventoryState.map((product) => product.category).filter(Boolean))].sort(), [inventoryState]);

  const basePeriodSales = useMemo(() => allSales.filter((sale) => (
    recordInPeriod(sale, periodKey, periodOptions)
    && (seller === "all" || sellerIdentity(sale) === seller)
  )), [allSales, period, from, to, timezone, workspaceSettings.businessDay, seller]);

  const categoryPredicate = (item) => {
    if (category === "all") return true;
    const product = productById.get(String(item.productId || item.id));
    return (item.category || product?.category) === category;
  };

  const filteredSales = useMemo(() => basePeriodSales
    .filter((sale) => matchesStore(sale, store, stores))
    .map((sale) => scopedSale(sale, category === "all" ? null : categoryPredicate))
    .filter((sale) => category === "all" || sale.items.length > 0), [basePeriodSales, store, stores, category, productById]);

  const previousRange=useMemo(()=>previousPeriodRange(periodKey,periodOptions),[periodKey,from,to,timezone,workspaceSettings.businessDay]);
  const previousSales=useMemo(()=>{
    if(!previousRange)return[];
    return allSales
      .filter((sale)=>recordInRange(sale,previousRange,timezone))
      .filter((sale)=>seller==="all"||sellerIdentity(sale)===seller)
      .filter((sale)=>matchesStore(sale,store,stores))
      .map((sale)=>scopedSale(sale,category==="all"?null:categoryPredicate))
      .filter((sale)=>category==="all"||sale.items.length>0);
  },[allSales,previousRange,timezone,seller,store,stores,category,productById]);

  const revenue = category==='all'&&summary.aggregate?summary.aggregate.netRevenue:filteredSales.reduce((sum, sale) => sum + saleNetRevenue(sale), 0);
  const gross = category==='all'&&summary.aggregate?summary.aggregate.grossProfit:filteredSales.reduce((sum, sale) => sum + saleNetProfit(sale), 0);
  const returnTotal = category==='all'&&summary.aggregate?summary.aggregate.refundAmount:filteredSales.reduce((sum, sale) => sum + returnedAmountForSale(sale), 0);
  const returnedSales = filteredSales.filter((sale) => returnedAmountForSale(sale) > 0).length;

  const filteredExpenses = useMemo(() => expenses.filter((expense) => (
    recordInPeriod(expense, periodKey, periodOptions) && matchesStore(expense, store, stores)
  )), [expenses, period, from, to, timezone, workspaceSettings.businessDay, store, stores]);
  const expenseTotal = summary.aggregate?.expenseTotal??filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const previousExpenses=useMemo(()=>previousRange?expenses.filter((expense)=>recordInRange(expense,previousRange,timezone)&&matchesStore(expense,store,stores)):[],[expenses,previousRange,timezone,store,stores]);
  const previousExpenseTotal=previousExpenses.reduce((sum,expense)=>sum+Number(expense.amount||0),0);
  const canCalculateNet = category === "all" && seller === "all";
  const net = canCalculateNet ? gross - expenseTotal : null;
  const transactionCount=category==='all'&&summary.aggregate?summary.aggregate.saleCount:filteredSales.filter(sale=>sale._financialType!=="refund").length;
  const avg = transactionCount ? revenue / transactionCount : 0;
  const previousRevenue=previousSales.reduce((sum,sale)=>sum+saleNetRevenue(sale),0);
  const previousGross=previousSales.reduce((sum,sale)=>sum+saleNetProfit(sale),0);
  const previousNet=canCalculateNet?previousGross-previousExpenseTotal:null;
  const previousAvg=previousSales.length?previousRevenue/previousSales.length:0;
  const compareHint=(current,previous,fallback)=>{
    if(!previousRange)return fallback;
    if(Math.abs(Number(previous||0))<0.01)return Number(current||0)>0?"Oldingi davrda ma’lumot yo‘q":"O‘zgarish yo‘q";
    const delta=((Number(current||0)-Number(previous||0))/Math.abs(Number(previous||0)))*100;
    return `${delta>=0?"+":""}${delta.toFixed(1)}% oldingi davrga nisbatan`;
  };

  const scopedInventory = useMemo(() => projectInventoryScope(inventoryState, store).filter((product) => category === "all" || product.category === category), [inventoryState, store, category]);
  const stockValue = scopedInventory.reduce((sum, product) => sum + Number(product.costPrice || 0) * Number(product.quantity || 0), 0);

  const productMap = {};
  filteredSales.forEach((sale) => (sale.items || []).forEach((item) => {
    const key = String(item.productId || item.id || item.name);
    const qty = Math.max(0, Number(item.quantity || item.qty || 0) - Number(item.returnedQty || 0));
    const value = Number(item.finalPrice || item.price || 0) * qty;
    productMap[key] = productMap[key] || { name:item.name, qty:0, revenue:0 };
    productMap[key].qty += qty;
    productMap[key].revenue += value;
  }));
  const topProducts = Object.values(productMap).sort((a,b) => b.revenue - a.revenue).slice(0,6);

  const payment = filteredSales.reduce((result, sale) => {
    const breakdown = saleNetPaymentBreakdown(sale);
    result.cash += breakdown.cash; result.card += breakdown.card; result.transfer += breakdown.transfer;
    return result;
  }, { cash:0, card:0, transfer:0 });
  const paymentData = [["Naqd",payment.cash],["Karta",payment.card],["O‘tkazma",payment.transfer]].filter(([,value]) => value > 0).map(([name,value]) => ({ name,value }));

  const trend = useMemo(() => {
    const map = {};
    filteredSales.forEach((sale) => {
      const key = recordDateKey(sale, timezone) || "Noma’lum";
      map[key] = map[key] || { key, label:key === "Noma’lum" ? key : key.slice(5).split("-").reverse().join("."), sales:0, profit:0, expenses:0 };
      map[key].sales += saleNetRevenue(sale);
      map[key].profit += saleNetProfit(sale);
    });
    if (canCalculateNet) filteredExpenses.forEach((expense) => {
      const key = recordDateKey(expense, timezone) || "Noma’lum";
      map[key] = map[key] || { key, label:key === "Noma’lum" ? key : key.slice(5).split("-").reverse().join("."), sales:0, profit:0, expenses:0 };
      map[key].expenses += Number(expense.amount || 0);
    });
    return Object.values(map).sort((a,b) => a.key.localeCompare(b.key)).slice(-18);
  }, [filteredSales, filteredExpenses, timezone, canCalculateNet]);

  const dead = scopedInventory.filter((product) => !product.archived && !productMap[String(product.id)] && Number(product.quantity) > 0).slice(0,5);
  const slow = scopedInventory.filter((product) => !product.archived && productMap[String(product.id)] && productMap[String(product.id)].qty <= 2 && Number(product.quantity) > 0).slice(0,5);

  const compare = stores.filter((item) => item.active !== false).map((branch) => {
    const branchSales = basePeriodSales
      .filter((sale) => matchesStore(sale, branch.id, stores))
      .map((sale) => scopedSale(sale, category === "all" ? null : categoryPredicate))
      .filter((sale) => category === "all" || sale.items.length > 0);
    return {
      store: branch.name,
      sales: branchSales.reduce((sum, sale) => sum + saleNetRevenue(sale), 0),
      profit: branchSales.reduce((sum, sale) => sum + saleNetProfit(sale), 0),
    };
  });

  const exportCsv = () => {
    const rows = [
      ["Ko‘rsatkich","Qiymat"], ["Sof savdo",revenue], ["Yalpi foyda",gross], ["Xarajat",canCalculateNet ? expenseTotal : "Filtr sabab hisoblanmadi"],
      ["Sof foyda",canCalculateNet ? net : "Filtr sabab hisoblanmadi"], ["Tranzaksiyalar",transactionCount], ["O‘rtacha chek",avg], ["Qaytarish",returnTotal],
    ];
    const csvCell=(value)=>{const text=String(value??"");return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text};
    const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type:"text/csv" }));
    anchor.download = `analitika-${workspaceDateISO(new Date(), timezone)}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const storeLabel = store === "all" ? "Barcha filiallar" : stores.find((item) => item.id === store)?.name;

  return <div className="pro-page analytics-pro">
    {(report.error||summary.error)&&<div className="pro-alert danger" role="alert">{report.error||summary.error}</div>}
    {(report.loading||summary.loading)&&<div className="pro-alert" role="status">Hisobot yuklanmoqda…</div>}
    <PageHeader title="Analitika" subtitle="Sof savdo, foyda, xarajat, qoldiq va qaytarishlarni bir xil hisoblash qoidasi bilan kuzating." actions={<button className="pro-btn secondary" onClick={exportCsv}><FiDownload/> CSV eksport</button>}/>

    <section className="analytics-filterbar pro-card">
      <div className="pro-tabs">{presets.map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div>
      {period === "Ixtiyoriy" && <><PremiumDateInput className="pro-date" value={from} onChange={(event) => setFrom(event.target.value)}/><PremiumDateInput className="pro-date" value={to} onChange={(event) => setTo(event.target.value)}/></>}
      <PremiumSelect className="pro-select" value={store} onChange={(event) => setStore(event.target.value)}><option value="all">Barcha filiallar</option>{stores.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</PremiumSelect>
      <PremiumSelect className="pro-select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Barcha kategoriyalar</option>{categories.map((item) => <option key={item}>{item}</option>)}</PremiumSelect>
      <PremiumSelect className="pro-select" value={seller} onChange={(event) => setSeller(event.target.value)}><option value="all">Barcha sotuvchilar</option>{sellers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</PremiumSelect>
    </section>

    <div className="pro-stat-grid analytics-kpis">
      <StatCard icon={FiShoppingCart} label="Sof savdo" value={formatPrice(revenue)} hint={compareHint(revenue,previousRevenue,`${transactionCount} ta tranzaksiya`)} tone="blue"/>
      <StatCard icon={FiTrendingUp} label="Yalpi foyda" value={formatPrice(gross)} hint={compareHint(gross,previousGross,`${revenue ? Math.round(gross / revenue * 100) : 0}% marja`)} tone="green"/>
      <StatCard icon={FiCreditCard} label="Sof foyda" value={canCalculateNet ? formatPrice(net) : "—"} hint={canCalculateNet ? compareHint(net,previousNet,`Xarajat: ${formatPrice(expenseTotal)}`) : "Kategoriya/sotuvchi filterida xarajat taqsimlanmaydi"} tone="purple"/>
      <StatCard icon={FiDollarSign} label="O‘rtacha chek" value={formatPrice(avg)} hint={compareHint(avg,previousAvg,storeLabel)} tone="orange"/>
    </div>

    <div className="analytics-grid-main">
      <section className="pro-card chart-card wide"><div className="pro-card-head"><div><h2>Savdo va foyda trendi</h2><p>{period} · {storeLabel}</p></div></div><div className="chart-wrap"><ResponsiveChart><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tick={{fontSize:9}} tickFormatter={(value) => `${Math.round(value/1000)}k`}/><Tooltip formatter={(value) => formatPrice(value)}/><Legend wrapperStyle={{fontSize:10}}/><Line type="monotone" dataKey="sales" name="Sof savdo" stroke="var(--primary)" strokeWidth={2.2}/><Line type="monotone" dataKey="profit" name="Yalpi foyda" stroke="#16a34a" strokeWidth={2}/>{canCalculateNet && <Line type="monotone" dataKey="expenses" name="Xarajat" stroke="#ef4444" strokeWidth={1.5}/>}</LineChart></ResponsiveChart></div></section>
      <section className="pro-card chart-card"><div className="pro-card-head"><div><h2>To‘lovlar</h2><p>Qaytarishdan keyingi sof taqsimot</p></div></div><div className="chart-wrap pie">{paymentData.length ? <ResponsiveChart><PieChart><Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78}>{paymentData.map((_,index) => <Cell key={index} fill={["#3b82f6","#8b5cf6","#f59e0b"][index % 3]}/>)}</Pie><Tooltip formatter={(value) => formatPrice(value)}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ResponsiveChart> : <div className="pro-empty">To‘lov ma’lumoti yo‘q</div>}</div></section>
    </div>

    <div className="analytics-grid-2">
      <section className="pro-card chart-card"><div className="pro-card-head"><div><h2>Filiallar taqqoslash</h2><p>Tanlangan davr va filterlar bo‘yicha</p></div></div><div className="chart-wrap"><ResponsiveChart><BarChart data={compare}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="store" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}} tickFormatter={(value) => `${Math.round(value/1000)}k`}/><Tooltip formatter={(value) => formatPrice(value)}/><Bar dataKey="sales" name="Sof savdo" fill="var(--primary)" radius={[7,7,0,0]}/><Bar dataKey="profit" name="Yalpi foyda" fill="#16a34a" radius={[7,7,0,0]}/></BarChart></ResponsiveChart></div></section>
      <section className="pro-card analytics-summary"><div className="pro-card-head"><div><h2>Biznes holati</h2><p>Tanlangan scope bo‘yicha</p></div></div><div className="insight-list"><div><FiPackage/><span><strong>Ombor qiymati</strong><small>{formatPrice(stockValue)}</small></span></div><div><FiRefreshCw/><span><strong>Qaytarishlar</strong><small>{returnedSales} ta savdo · {formatPrice(returnTotal)}</small></span></div><div><FiBarChart2/><span><strong>Qaytarish darajasi</strong><small>{revenue + returnTotal ? `${(returnTotal/(revenue + returnTotal)*100).toFixed(1)}%` : "0%"}</small></span></div></div></section>
    </div>

    <div className="analytics-bottom-grid">
      <section className="pro-card"><div className="pro-card-head"><div><h2>Eng ko‘p sotilgan mahsulotlar</h2><p>Sof savdo summasi bo‘yicha</p></div></div><div className="rank-list">{topProducts.length ? topProducts.map((product,index) => <div key={product.name}><b>{index+1}</b><span><strong>{product.name}</strong><small>{product.qty} {product.qty === 1 ? "birlik" : "birlik"}</small></span><em>{formatPrice(product.revenue)}</em></div>) : <div className="pro-empty">Savdo ma’lumoti yo‘q</div>}</div></section>
      <section className="pro-card"><div className="pro-card-head"><div><h2>Sekin aylanayotgan qoldiq</h2><p>Tanlangan filialdagi mahsulotlar</p></div></div><div className="stock-risk-list">{dead.map((product) => <div key={product.id}><span><strong>{product.name}</strong><small>{product.quantity} {product.unit || "dona"} qoldiq</small></span><StatusBadge tone="danger">Sotilmagan</StatusBadge></div>)}{slow.map((product) => <div key={product.id}><span><strong>{product.name}</strong><small>{product.quantity} {product.unit || "dona"} qoldiq</small></span><StatusBadge tone="warning">Sekin</StatusBadge></div>)}{!dead.length && !slow.length && <div className="pro-empty">Riskli qoldiq topilmadi</div>}</div></section>
    </div>
  </div>;
}

export default Analytics;
