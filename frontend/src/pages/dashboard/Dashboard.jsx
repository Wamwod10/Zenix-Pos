import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle, FiArrowRight, FiCreditCard, FiDollarSign, FiPackage, FiRefreshCw,
  FiShoppingBag, FiTrendingDown, FiTrendingUp, FiTruck, FiRotateCcw, FiActivity,
} from "react-icons/fi";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { formatPrice } from "../../utils/formatPrice";
import { getSaleNetTotal, getSaleProfit, getNetSoldQty, getItemFinalPrice } from "../../utils/returns";
import { saleNetPaymentBreakdown, returnedAmountForSale } from "../../utils/reporting";
import { formatWorkspaceDate, workspaceDateISO } from "../../utils/workspaceDate";
import { supplierOpenDebt } from "../../utils/supplierLedger";
import { PageHeader, PremiumSelect, StatCard, StatusBadge } from "../../components/Ui";
import ResponsiveChart from "../../components/ResponsiveChart";
import "./dashboard.scss";

const dayKey=(value,timezone="Asia/Tashkent")=>{if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return String(value);const d=value?new Date(value):new Date();if(Number.isNaN(d.getTime()))return "";return workspaceDateISO(d,timezone)};
const shiftDayKey=(key,delta)=>{const [year,month,day]=String(key||"").split("-").map(Number);if(!year||!month||!day)return "";const date=new Date(Date.UTC(year,month-1,day+delta,12));return date.toISOString().slice(0,10)};
const isBetween=(value,startKey,endKey,timezone)=>{const key=dayKey(value,timezone);return Boolean(key&&key>=startKey&&key<=endKey)};
const pct=(current,previous)=>Number(previous)!==0?((current-previous)/Math.abs(previous))*100:(Number(current)!==0?null:0);
const formatPct=(value)=>value==null?"Yangi":`${value>=0?"+":""}${Math.round(value)}%`;

function Dashboard(){
  const {inventoryState,dailySales,salesHistory,expenses,suppliers,returns,stores,currentStore,currentStoreId,effectiveWorkspaceSettings:workspaceSettings}=useStore();
  const organizationSettings=workspaceSettings.organization||{};
  const [period,setPeriod]=useState("7");
  const [store,setStore]=useState(currentStoreId);
  useEffect(()=>setStore(currentStoreId),[currentStoreId]);

  const activeStores=stores.filter(s=>s.active!==false);
  const defaultStoreId=activeStores[0]?.id||currentStoreId;
  const selectedStore=store==="all"?null:stores.find(item=>item.id===store);
  const belongsToStore=(record,storeId)=>{
    if(storeId==="all")return true;
    if(record?.storeId)return record.storeId===storeId;
    if(record?.store)return record.store===stores.find(item=>item.id===storeId)?.name;
    return storeId===defaultStoreId;
  };

  const allSales=useMemo(()=>[
    ...dailySales,
    ...salesHistory.flatMap(day=>(day.sales||[]).map(s=>({...s,dateISO:s.dateISO||day.dateISO,date:s.date||day.date,storeId:s.storeId||day.storeId,store:s.store||day.store}))),
  ],[dailySales,salesHistory]);

  const range=useMemo(()=>{
    const endKey=workspaceDateISO(new Date(),organizationSettings.timezone);
    if(period==="all")return{startKey:"0000-01-01",endKey,previousStartKey:null,previousEndKey:null,days:14};
    const days=Math.max(1,Number(period));
    const startKey=shiftDayKey(endKey,-days+1);
    const previousEndKey=shiftDayKey(startKey,-1);
    const previousStartKey=shiftDayKey(previousEndKey,-days+1);
    return{startKey,endKey,previousStartKey,previousEndKey,days};
  },[period,organizationSettings.timezone]);

  const sales=useMemo(()=>allSales.filter(s=>belongsToStore(s,store)&&(period==="all"||isBetween(s.dateISO||s.date,range.startKey,range.endKey,organizationSettings.timezone))),[allSales,store,period,range,stores,organizationSettings.timezone]);
  const previousSales=useMemo(()=>period==="all"?[]:allSales.filter(s=>belongsToStore(s,store)&&isBetween(s.dateISO||s.date,range.previousStartKey,range.previousEndKey,organizationSettings.timezone)),[allSales,store,period,range,stores,organizationSettings.timezone]);
  const filteredExpenses=useMemo(()=>expenses.filter(e=>belongsToStore(e,store)&&(period==="all"||isBetween(e.dateISO||e.date,range.startKey,range.endKey,organizationSettings.timezone))),[expenses,store,period,range,stores,organizationSettings.timezone]);
  const previousExpenses=useMemo(()=>period==="all"?[]:expenses.filter(e=>belongsToStore(e,store)&&isBetween(e.dateISO||e.date,range.previousStartKey,range.previousEndKey,organizationSettings.timezone)),[expenses,store,period,range,stores,organizationSettings.timezone]);

  const revenue=sales.reduce((sum,s)=>sum+getSaleNetTotal(s),0);
  const previousRevenue=previousSales.reduce((sum,s)=>sum+getSaleNetTotal(s),0);
  const grossProfit=sales.reduce((sum,s)=>sum+getSaleProfit(s),0);
  const previousGross=previousSales.reduce((sum,s)=>sum+getSaleProfit(s),0);
  const expenseTotal=filteredExpenses.reduce((sum,e)=>sum+Number(e.amount||0),0);
  const previousExpense=previousExpenses.reduce((sum,e)=>sum+Number(e.amount||0),0);
  const netProfit=grossProfit-expenseTotal;
  const previousNet=previousGross-previousExpense;
  const transactions=sales.length;
  const previousTransactions=previousSales.length;
  const average=transactions?revenue/transactions:0;
  const previousAverage=previousTransactions?previousRevenue/previousTransactions:0;
  const margin=revenue?grossProfit/revenue*100:0;

  const payment={cash:0,card:0,transfer:0};
  sales.forEach((sale)=>{
    const breakdown=saleNetPaymentBreakdown(sale);
    payment.cash+=Number(breakdown.cash||0);
    payment.card+=Number(breakdown.card||0);
    payment.transfer+=Number(breakdown.transfer||0);
  });

  const scopedInventory=useMemo(()=>{
    if(store!=="all")return inventoryState.map(p=>({...p,quantity:Number(p.stockByStore?.[store]||0),stock:Number(p.stockByStore?.[store]||0)}));
    return inventoryState.map(p=>{const quantity=Object.values(p.stockByStore||{}).reduce((sum,n)=>sum+Number(n||0),0);return{...p,quantity,stock:quantity}});
  },[inventoryState,store]);
  const activeInventory=scopedInventory.filter(p=>!p.archived);
  const inventoryValue=activeInventory.reduce((sum,p)=>sum+Number(p.costPrice||0)*Number(p.quantity||0),0);
  const low=activeInventory.filter(p=>Number(p.quantity)>0&&Number(p.quantity)<=Number(p.minStock||5));
  const out=activeInventory.filter(p=>Number(p.quantity)<=0);
  const supplierDebt=suppliers.filter(s=>!s.archived).reduce((sum,s)=>sum+supplierOpenDebt(s),0);
  const scopedReturns=returns.filter(r=>belongsToStore(r,store)&&(period==="all"||isBetween(r.dateISO||r.date,range.startKey,range.endKey,organizationSettings.timezone)));
  const returnTotal=sales.reduce((sum,sale)=>sum+returnedAmountForSale(sale),0);
  const grossRevenue=revenue+returnTotal;
  const returnRate=grossRevenue?returnTotal/grossRevenue*100:0;

  const trend=useMemo(()=>{
    const days=period==="all"?14:Math.min(14,Number(period));
    const grouped=new Map();
    for(const sale of allSales){
      if(!belongsToStore(sale,store))continue;
      const key=dayKey(sale.dateISO||sale.date,organizationSettings.timezone);
      if(!key)continue;
      const row=grouped.get(key)||{sales:0,profit:0};
      row.sales+=getSaleNetTotal(sale);
      row.profit+=getSaleProfit(sale);
      grouped.set(key,row);
    }
    const rows=[];
    const todayKey=workspaceDateISO(new Date(),organizationSettings.timezone);
    for(let i=days-1;i>=0;i--){
      const key=shiftDayKey(todayKey,-i);
      const labelDate=new Date(`${key}T12:00:00Z`);
      const row=grouped.get(key)||{sales:0,profit:0};
      rows.push({date:formatWorkspaceDate(labelDate,organizationSettings,{short:true}),sales:row.sales,profit:row.profit});
    }
    return rows;
  },[allSales,period,store,stores,organizationSettings.timezone,organizationSettings.dateFormat]);

  const topProducts=useMemo(()=>{
    const map=new Map();
    sales.forEach(sale=>(sale.items||[]).forEach(item=>{
      const key=item.productId||item.id||item.name;
      const quantity=getNetSoldQty(item);
      if(quantity<=0)return;
      const unit=getItemFinalPrice(item);
      const cost=Number(item.costPrice||0);
      const current=map.get(key)||{id:key,name:item.name||"Mahsulot",qty:0,revenue:0,profit:0};
      current.qty+=quantity;current.revenue+=quantity*unit;current.profit+=quantity*(unit-cost);map.set(key,current);
    }));
    return [...map.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,5);
  },[sales]);

  const expenseBreakdown=useMemo(()=>{
    const map=new Map();
    filteredExpenses.forEach(item=>{const key=item.category||"Boshqa";map.set(key,(map.get(key)||0)+Number(item.amount||0))});
    return [...map.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,5);
  },[filteredExpenses]);

  const branchPerformance=useMemo(()=>activeStores.map(branch=>{
    const branchSales=allSales.filter(sale=>belongsToStore(sale,branch.id)&&(period==="all"||isBetween(sale.dateISO||sale.date,range.startKey,range.endKey,organizationSettings.timezone)));
    return {
      id:branch.id,name:branch.name,transactions:branchSales.length,
      revenue:branchSales.reduce((sum,sale)=>sum+getSaleNetTotal(sale),0),
      profit:branchSales.reduce((sum,sale)=>sum+getSaleProfit(sale),0),
    };
  }).sort((a,b)=>b.revenue-a.revenue),[activeStores,allSales,period,range,stores,organizationSettings.timezone]);

  const sellerPerformance=useMemo(()=>{
    const map=new Map();
    sales.forEach(sale=>{const name=sale.sellerName||sale.seller||"Noma’lum";const current=map.get(name)||{name,revenue:0,transactions:0};current.revenue+=getSaleNetTotal(sale);current.transactions+=1;map.set(name,current)});
    return [...map.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,4);
  },[sales]);

  const peakHour=useMemo(()=>{
    const hours={};sales.forEach(s=>{const hour=String(s.time||"").split(":")[0];if(hour)hours[hour]=(hours[hour]||0)+getSaleNetTotal(s)});
    const best=Object.entries(hours).sort((a,b)=>b[1]-a[1])[0];return best?`${best[0]}:00–${String(Number(best[0])+1).padStart(2,"0")}:00`:"—";
  },[sales]);

  const stockAlerts=[...out.map(p=>({...p,alert:"Tugagan",tone:"danger"})),...low.map(p=>({...p,alert:"Kam qoldiq",tone:"warning"}))].slice(0,6);
  const paymentTotal=payment.cash+payment.card+payment.transfer||1;
  const salesChange=pct(revenue,previousRevenue);
  const profitChange=pct(netProfit,previousNet);
  const avgChange=pct(average,previousAverage);
  const stockForecast=useMemo(()=>{
    const sold=new Map();
    sales.forEach(sale=>(sale.items||[]).forEach(item=>{const id=String(item.productId||item.id||"");if(!id)return;sold.set(id,(sold.get(id)||0)+Math.max(0,getNetSoldQty(item)))}));
    const days=Math.max(1,period==="all"?30:Number(period)||1);
    return activeInventory.map(product=>{const qty=sold.get(String(product.id))||0;const perDay=qty/days;return {...product,soldQty:qty,daysLeft:perDay>0?Number(product.quantity||0)/perDay:null}}).filter(product=>product.daysLeft!=null&&product.daysLeft<=7).sort((a,b)=>a.daysLeft-b.daysLeft).slice(0,3);
  },[sales,activeInventory,period]);
  const pulse=useMemo(()=>{const items=[];if(out.length)items.push({tone:"danger",title:`${out.length} ta mahsulot tugagan`,text:"Savdo yo‘qotmaslik uchun qoldiqni to‘ldiring",path:"/inventory"});if(stockForecast.length)items.push({tone:"warning",title:`${stockForecast.length} ta mahsulot tez tugashi mumkin`,text:`${stockForecast[0].name} · taxminan ${Math.max(1,Math.ceil(stockForecast[0].daysLeft))} kunlik qoldiq`,path:"/inventory"});if(returnRate>=5)items.push({tone:"warning",title:"Qaytarish darajasi yuqori",text:`Tanlangan davrda ${returnRate.toFixed(1)}%`,path:"/analytics"});if(salesChange!=null&&salesChange<=-20)items.push({tone:"info",title:"Savdo pasayishi kuzatildi",text:`Oldingi davrga nisbatan ${Math.abs(Math.round(salesChange))}% past`,path:"/analytics"});if(supplierDebt>0)items.push({tone:"neutral",title:"Ta’minotchi majburiyatlari",text:`Ochiq qarz ${formatPrice(supplierDebt)}`,path:"/suppliers"});return items.slice(0,4)},[out,stockForecast,returnRate,salesChange,supplierDebt]);

  return <div className="pro-page dashboard-pro">
    <PageHeader
      title="Boshqaruv paneli"
      subtitle={`${selectedStore?.name||"Barcha filiallar"} · biznes holati va asosiy ko‘rsatkichlar`}
      actions={<div className="dashboard-filters"><PremiumSelect className="pro-select" value={period} onChange={e=>setPeriod(e.target.value)}><option value="1">Bugun</option><option value="7">7 kun</option><option value="30">30 kun</option><option value="all">Barcha davr</option></PremiumSelect><PremiumSelect className="pro-select" value={store} onChange={e=>setStore(e.target.value)}><option value="all">Barcha filiallar</option>{activeStores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</PremiumSelect></div>}
    />

    <section className="pro-card zenix-pulse"><div className="pro-card-head"><div><h2>Zenix Pulse</h2><p>{pulse.length?`${pulse.length} ta e’tibor talab qiladigan signal`:"Biznesning asosiy ko‘rsatkichlari me’yorda"}</p></div><StatusBadge tone={pulse.some(x=>x.tone==="danger")?"danger":pulse.length?"warning":"success"}>{pulse.length?"E’tibor kerak":"Hammasi joyida"}</StatusBadge></div>{pulse.length?<div className="pulse-grid">{pulse.map((item,index)=><Link to={item.path} className={`pulse-item ${item.tone}`} key={`${item.title}-${index}`}><span><strong>{item.title}</strong><small>{item.text}</small></span><FiArrowRight/></Link>)}</div>:<div className="dashboard-empty compact"><FiActivity/> Hozircha kritik signal aniqlanmadi</div>}</section>

    <div className="dashboard-kpis">
      <StatCard icon={FiTrendingUp} label="Savdo" value={formatPrice(revenue)} hint={`${transactions} ta tranzaksiya`} tone="blue" trend={period!=="all"?{label:formatPct(salesChange),tone:salesChange==null?"neutral":salesChange>=0?"up":"down"}:null}/>
      <StatCard icon={FiDollarSign} label="Sof foyda" value={formatPrice(netProfit)} hint={`Xarajat ${formatPrice(expenseTotal)}`} tone="green" trend={period!=="all"?{label:formatPct(profitChange),tone:profitChange==null?"neutral":profitChange>=0?"up":"down"}:null}/>
      <StatCard icon={FiShoppingBag} label="O‘rtacha chek" value={formatPrice(average)} hint={`${transactions} ta chek`} tone="purple" trend={period!=="all"?{label:formatPct(avgChange),tone:avgChange==null?"neutral":avgChange>=0?"up":"down"}:null}/>
      <StatCard icon={FiActivity} label="Yalpi marja" value={`${margin.toFixed(1)}%`} hint={formatPrice(grossProfit)} tone="teal"/>
      <StatCard icon={FiPackage} label="Ombor qiymati" value={formatPrice(inventoryValue)} hint={`${low.length} kam · ${out.length} tugagan`} tone="orange"/>
      <StatCard icon={FiRotateCcw} label="Qaytarish" value={formatPrice(returnTotal)} hint={`${scopedReturns.length} ta · ${returnRate.toFixed(1)}%`} tone="red"/>
    </div>

    <div className="dashboard-main-grid">
      <section className="pro-card dashboard-chart">
        <div className="pro-card-head"><div><h2>Savdo dinamikasi</h2><p>{period==="all"?"Barcha davr summalari · grafik oxirgi 14 kunni ko‘rsatadi.":"Kunlik savdo va yalpi foyda o‘zgarishi."}</p></div><div className="chart-legend"><span><i className="sales"/>Savdo</span><span><i className="profit"/>Foyda</span></div></div>
        <div className="dashboard-chart-area"><ResponsiveChart><AreaChart data={trend} margin={{left:2,right:4,top:10,bottom:0}}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".18"/><stop offset="100%" stopColor="var(--primary)" stopOpacity="0"/></linearGradient><linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6c927b" stopOpacity=".12"/><stop offset="100%" stopColor="#6c927b" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 7"/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fill:"var(--muted)",fontSize:11}}/><YAxis tickFormatter={v=>`${Math.round(v/1000)}k`} tickLine={false} axisLine={false} width={48} tick={{fill:"var(--muted)",fontSize:10}}/><Tooltip formatter={v=>formatPrice(v)} contentStyle={{border:"1px solid var(--border)",borderRadius:14,background:"var(--card-bg)",boxShadow:"var(--shadow-soft)"}}/><Area type="monotone" dataKey="sales" stroke="var(--primary)" fill="url(#salesFill)" strokeWidth={2.3} dot={false}/><Area type="monotone" dataKey="profit" stroke="#6c927b" fill="url(#profitFill)" strokeWidth={1.8} dot={false}/></AreaChart></ResponsiveChart></div>
      </section>

      <section className="pro-card dashboard-payment"><div className="pro-card-head"><div><h2>To‘lovlar</h2><p>Tanlangan davrdagi to‘lov tarkibi.</p></div><FiCreditCard/></div>{[["Naqd",payment.cash,"cash"],["Karta",payment.card,"card"],["O‘tkazma",payment.transfer,"transfer"]].map(([label,value,tone])=><div className="pay-row" key={label}><div><span>{label}</span><strong>{formatPrice(value)}</strong></div><div className="pay-bar"><i className={tone} style={{width:`${Math.round(value/paymentTotal*100)}%`}}/></div><small>{Math.round(value/paymentTotal*100)}%</small></div>)}<div className="payment-insight"><span>Eng faol vaqt</span><strong>{peakHour}</strong></div></section>
    </div>

    <div className="dashboard-insight-grid">
      <section className="pro-card top-products-card"><div className="pro-card-head"><div><h2>Eng daromadli mahsulotlar</h2><p>Tanlangan davrda eng ko‘p daromad bergan mahsulotlar.</p></div><Link to="/analytics">Batafsil <FiArrowRight/></Link></div>{topProducts.length?<div className="top-product-list">{topProducts.map((item,index)=><div key={item.id}><span className="rank">{String(index+1).padStart(2,"0")}</span><span><strong>{item.name}</strong><small>{item.qty} dona · foyda {formatPrice(item.profit)}</small></span><b>{formatPrice(item.revenue)}</b></div>)}</div>:<div className="dashboard-empty"><FiShoppingBag/> Tanlangan filialda savdo ma’lumoti yo‘q</div>}</section>

      <section className="pro-card dashboard-alerts"><div className="pro-card-head"><div><h2>Qoldiq ogohlantirishlari</h2><p>Tez e’tibor talab qiladigan qoldiqlar.</p></div><Link to="/inventory">Ombor <FiArrowRight/></Link></div>{stockAlerts.length?<div className="alert-list">{stockAlerts.map(p=><div key={p.id}><span className={`alert-icon ${p.tone}`}><FiAlertTriangle/></span><span><strong>{p.name}</strong><small>{p.sku} · {p.quantity} {p.unit||"dona"}</small></span><StatusBadge tone={p.tone}>{p.alert}</StatusBadge></div>)}</div>:<div className="dashboard-empty"><FiPackage/> Qoldiq bo‘yicha jiddiy muammo yo‘q</div>}</section>
    </div>

    <div className="dashboard-analysis-grid">
      <section className="pro-card breakdown-card"><div className="pro-card-head"><div><h2>Xarajatlar tarkibi</h2><p>Qaysi kategoriyalar eng katta xarajat qilayotganini ko‘ring.</p></div><strong>{formatPrice(expenseTotal)}</strong></div>{expenseBreakdown.length?<div className="breakdown-list">{expenseBreakdown.map(item=><div key={item.name}><div><span>{item.name}</span><b>{formatPrice(item.value)}</b></div><div className="breakdown-bar"><i style={{width:`${expenseTotal?Math.max(4,Math.round(item.value/expenseTotal*100)):0}%`}}/></div><small>{expenseTotal?Math.round(item.value/expenseTotal*100):0}%</small></div>)}</div>:<div className="dashboard-empty compact"><FiCreditCard/> Tanlangan davrda xarajat yo‘q</div>}</section>
      <section className="pro-card branch-performance-card"><div className="pro-card-head"><div><h2>Filiallar natijasi</h2><p>Bir davr ichida filiallar savdosini taqqoslang.</p></div><StatusBadge tone="neutral">{activeStores.length} filial</StatusBadge></div><div className="branch-performance-list">{branchPerformance.map(branch=><button key={branch.id} className={branch.id===store?"active":""} onClick={()=>setStore(branch.id)}><span><strong>{branch.name}</strong><small>{branch.transactions} ta savdo · foyda {formatPrice(branch.profit)}</small></span><b>{formatPrice(branch.revenue)}</b></button>)}</div></section>
      <section className="pro-card seller-performance-card"><div className="pro-card-head"><div><h2>Sotuvchilar</h2><p>Tanlangan filial va davr bo‘yicha eng faol xodimlar.</p></div><Link to="/seller-analytics">Batafsil <FiArrowRight/></Link></div>{sellerPerformance.length?<div className="seller-performance-list">{sellerPerformance.map((seller,index)=><div key={seller.name}><span className="rank">{index+1}</span><span><strong>{seller.name}</strong><small>{seller.transactions} ta tranzaksiya</small></span><b>{formatPrice(seller.revenue)}</b></div>)}</div>:<div className="dashboard-empty compact"><FiShoppingBag/> Sotuvchi statistikasi hali yo‘q</div>}</section>
    </div>

    <section className="pro-card dashboard-health"><div className="pro-card-head"><div><h2>Biznes holati</h2><p>Egasi uchun tezkor operatsion ko‘rsatkichlar.</p></div><FiRefreshCw/></div><div className="health-grid"><div><span>Ta’minotchi qarzi</span><strong>{formatPrice(supplierDebt)}</strong><small><FiTruck/> {suppliers.filter(s=>!s.archived).length} ta ta’minotchi</small></div><div><span>Yalpi foyda</span><strong>{formatPrice(grossProfit)}</strong><small>{margin.toFixed(1)}% marja</small></div><div><span>Qaytarish darajasi</span><strong>{returnRate.toFixed(1)}%</strong><small>{scopedReturns.length} ta qaytarish</small></div><div><span>Qoldiq muammosi</span><strong>{low.length+out.length}</strong><small>{out.length} ta tugagan</small></div></div></section>
  </div>;
}
export default Dashboard;
