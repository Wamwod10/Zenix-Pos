import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiEye, FiFilter, FiPrinter, FiRefreshCw, FiRotateCcw, FiSearch, FiShoppingBag } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { ROLES } from "../../config/roles";
import { formatPrice } from "../../utils/formatPrice";
import { applyReturnToSale, getRefundAllocation, getRefundCashAdjustment, RETURN_REASONS } from "../../utils/returns";
import { restoreTrackedStock } from "../../utils/stockTracking";
import { formatWorkspaceDate, workspaceDateISO, workspaceTime } from "../../utils/workspaceDate";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, PremiumDateInput, ColumnPicker } from "../../components/Ui";
import usePersistentColumns from "../../utils/usePersistentColumns";
import Modal from "../../components/Modal";
import "./history.scss";

const payLabel={cash:"Naqd",card:"Karta",transfer:"O‘tkazma",split:"Aralash"};
const iso=(sale,day)=>sale.dateISO||day?.dateISO||"";
const net=(sale)=>Math.max(0,Number(sale.saleTotal||sale.total||0)-Number(sale.returnedTotal||0));
function History(){
  const {currentUser}=useAuth();
  const location=useLocation();
  const {dailySales,salesHistory,returns,effectiveWorkspaceSettings:workspaceSettings,stores,getStoreProduct,currentStoreId,hasPermission,activeShift,commitReturnTransaction}=useStore();
  const [search,setSearch]=useState(()=>new URLSearchParams(location.search).get("search")||"");const [from,setFrom]=useState("");const [to,setTo]=useState("");const [seller,setSeller]=useState("all");const [payment,setPayment]=useState("all");const [store,setStore]=useState("all");const [shift,setShift]=useState("all");
  useEffect(()=>{const query=new URLSearchParams(location.search).get("search");if(query!=null)setSearch(query)},[location.search]);
  const [selected,setSelected]=useState(null);const [returnSale,setReturnSale]=useState(null);const [returnItem,setReturnItem]=useState(null);const [returnQty,setReturnQty]=useState(1);const [returnReason,setReturnReason]=useState("");const [refundMethod,setRefundMethod]=useState("original");const [returnError,setReturnError]=useState("");
  const historyColumnDefs=[{id:"seller",label:"Sotuvchi"},{id:"store",label:"Filial / Smena"},{id:"payment",label:"To‘lov"},{id:"gross",label:"Jami"},{id:"returns",label:"Qaytarish"},{id:"net",label:"Sof"}];
  const historyColumnsControl=usePersistentColumns("zenix_history_columns",historyColumnDefs,{required:["net"]});
  const {visible:historyColumns,toggle:toggleHistoryColumn,orderedVisibleDefinitions:orderedHistoryColumns,columnStyle:historyColumnStyle}=historyColumnsControl;
  const isCashier=currentUser?.appRole===ROLES.CASHIER;const canReturn=hasPermission("returns",currentUser?.appRole);
  const receiptCopies=Math.max(1,Math.min(3,Number(workspaceSettings.receipt?.copies||1)));
  const currentIdentityIds=[currentUser?.employeeId,currentUser?.id].filter(Boolean).map(String);
  const sellerKey=(sale)=>String(sale?.sellerId||sale?.sellerAccountId||`name:${sale?.sellerName||sale?.seller||""}`);
  const isOwnSale=(sale)=>{
    const identity=sale?.sellerId||sale?.sellerAccountId;
    return identity?currentIdentityIds.includes(String(identity)):(sale?.sellerName||sale?.seller||"")===currentUser?.name;
  };
  const all=useMemo(()=>[
    ...(dailySales||[]).filter(Boolean).map(s=>({...s,_source:"daily",dateISO:s.dateISO||workspaceDateISO(new Date(),workspaceSettings.organization.timezone)})),
    ...(salesHistory||[]).filter(Boolean).flatMap(day=>(day.sales||[]).filter(Boolean).map(s=>({...s,_source:"history",_dayId:day.id,dateISO:iso(s,day),date:s.date||day.date}))),
  ],[dailySales,salesHistory,workspaceSettings.organization.timezone]);
  const sellers=[...new Map(all.map((sale)=>[sellerKey(sale),{key:sellerKey(sale),name:sale.sellerName||sale.seller||"Noma’lum"}])).values()];const shifts=[...new Set(all.map(s=>s.shiftId).filter(Boolean))];
  const filtered=useMemo(()=>all.filter(s=>{const q=search.trim().toLowerCase(),key=s.dateISO||"",name=s.sellerName||s.seller||"";if(isCashier&&!isOwnSale(s))return false;if(from&&key<from)return false;if(to&&key>to)return false;if(seller!=="all"&&sellerKey(s)!==seller)return false;if(payment!=="all"&&s.paymentMethod!==payment)return false;if(store!=="all"&&((s.storeId&&s.storeId!==store)||(!s.storeId&&(s.store||stores[0]?.name)!==stores.find(x=>x.id===store)?.name)))return false;if(shift!=="all"&&s.shiftId!==shift)return false;if(q&&!`${s.id} ${name} ${s.customer||""} ${(s.items||[]).filter(Boolean).map(i=>i?.name||"").join(" ")}`.toLowerCase().includes(q))return false;return true}).sort((a,b)=>`${b.dateISO||""} ${b.time||""}`.localeCompare(`${a.dateISO||""} ${a.time||""}`)),[all,search,from,to,seller,payment,store,shift,isCashier,currentUser,stores]);
  const revenue=filtered.reduce((sum,s)=>sum+net(s),0);const returned=filtered.reduce((sum,s)=>sum+Number(s.returnedTotal||0),0);const avg=filtered.length?revenue/filtered.length:0;
  const openReturn=(sale)=>{setReturnSale(sale);setReturnItem(null);setReturnQty(1);setReturnReason("");setRefundMethod("original");setReturnError("")};
  const applyReturn=async()=>{
    if(!canReturn||!returnSale||!returnItem||!returnReason)return;
    setReturnError("");
    const productId=returnItem.productId||returnItem.id;
    const result=applyReturnToSale(returnSale,productId,returnQty);
    if(!result.quantity)return;
    const allocation=getRefundAllocation(returnSale,result.amount,refundMethod);
    const cashAdjustment=getRefundCashAdjustment(returnSale,result.amount,refundMethod,activeShift?.id);
    if(cashAdjustment&&!activeShift){setReturnError("Naqd pul harakati talab qilinadi. Avval Kassa / Smena bo‘limidan smenani oching.");return}
    const returnStoreId=returnSale.storeId||currentStoreId;
    if(String(returnStoreId)!==String(currentStoreId)){setReturnError("Qaytarish savdo amalga oshirilgan filialda bajarilishi kerak. Avval o‘sha filialga o‘ting.");return}
    const product=getStoreProduct(productId,returnStoreId);
    if(!product){setReturnError("Mahsulot katalogda topilmadi. Qoldiqni tiklamasdan qaytarish bajarilmaydi.");return}
    const returnId=`RET-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const restored=restoreTrackedStock(product,returnStoreId,result.quantity,returnItem.tracking,Number(returnItem.returnedQty||0),{saleId:returnSale.id,returnId});
    if(!restored.success){setReturnError(restored.message||"Qoldiqni qaytarib bo‘lmadi.");return}
    const productUpdates=[restored.product];
    const now=new Date();
    const record={id:returnId,saleId:returnSale.id,storeId:returnSale.storeId||currentStoreId,shiftId:returnSale.shiftId||"",refundShiftId:activeShift?.id||"",productId,productName:returnItem.name,quantity:result.quantity,amount:result.amount,reason:returnReason,refundMethod,refundBreakdown:allocation,dateISO:workspaceDateISO(now,workspaceSettings.organization.timezone),date:formatWorkspaceDate(now,workspaceSettings.organization),time:workspaceTime(now,workspaceSettings.organization)};
    const cashMovement=cashAdjustment&&activeShift?{id:crypto.randomUUID(),type:cashAdjustment.type,amount:cashAdjustment.amount,reason:`Qaytarish: ${returnSale.id}`,time:workspaceTime(now,workspaceSettings.organization),source:"return-adjustment",saleId:returnSale.id}:null;
    const committed=await commitReturnTransaction({saleId:returnSale.id,updatedSale:result.sale,productUpdates,stockStoreId:returnStoreId,returnRecord:record,cashMovement,activity:{type:"return",title:"Qaytarish qilindi",description:`${returnItem.name} · ${result.quantity} dona · ${formatPrice(result.amount)}`}});
    if(!committed.success){setReturnError(committed.message||"Qaytarishni saqlab bo‘lmadi.");return}
    setReturnSale(null);setSelected(null);
  };
  const reset=()=>{setSearch("");setFrom("");setTo("");setSeller("all");setPayment("all");setStore("all");setShift("all")};
  return <div className="pro-page history-pro"><PageHeader title="Savdo tarixi" subtitle="Cheklar, to‘lovlar, kassirlar va qaytarishlarni bitta joydan boshqaring." actions={<><ColumnPicker columns={historyColumnDefs} visible={historyColumns} order={historyColumnsControl.order} widths={historyColumnsControl.widths} views={historyColumnsControl.views} onToggle={toggleHistoryColumn} onMove={historyColumnsControl.move} onWidth={historyColumnsControl.setWidth} onReset={historyColumnsControl.reset} onSaveView={historyColumnsControl.saveView} onApplyView={historyColumnsControl.applyView} onDeleteView={historyColumnsControl.deleteView}/><button className="pro-btn secondary" onClick={reset}><FiRefreshCw/> Filtrlarni tozalash</button></>}/>
    <div className="pro-stat-grid"><StatCard icon={FiShoppingBag} label="Savdolar" value={filtered.length} hint="Filtr natijasi" tone="blue"/><StatCard icon={FiCalendar} label="Sof savdo" value={formatPrice(revenue)} hint={`Qaytarish: ${formatPrice(returned)}`} tone="green"/><StatCard icon={FiFilter} label="O‘rtacha chek" value={formatPrice(avg)} hint="Sof summa bo‘yicha" tone="purple"/><StatCard icon={FiRotateCcw} label="Qaytarishlar" value={(returns||[]).length} hint="Barcha qaytarish yozuvlari" tone="orange"/></div>
    <section className="pro-card history-table-card"><div className="history-filter-grid"><div className="pro-search"><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Savdo ID, mahsulot, mijoz yoki sotuvchi..."/></div><PremiumDateInput className="pro-date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="Boshlanish sanasi"/><PremiumDateInput className="pro-date" value={to} onChange={e=>setTo(e.target.value)} aria-label="Tugash sanasi"/><PremiumSelect className="pro-select" value={seller} onChange={e=>setSeller(e.target.value)} disabled={isCashier}><option value="all">Barcha sotuvchilar</option>{sellers.map(x=><option key={x.key} value={x.key}>{x.name}</option>)}</PremiumSelect><PremiumSelect className="pro-select" value={payment} onChange={e=>setPayment(e.target.value)}><option value="all">Barcha to‘lovlar</option><option value="cash">Naqd</option><option value="card">Karta</option><option value="transfer">O‘tkazma</option><option value="split">Aralash</option></PremiumSelect><PremiumSelect className="pro-select" value={shift} onChange={e=>setShift(e.target.value)}><option value="all">Barcha smenalar</option>{shifts.map(x=><option key={x}>{x}</option>)}</PremiumSelect><PremiumSelect className="pro-select" value={store} onChange={e=>setStore(e.target.value)}><option value="all">Barcha filiallar</option>{stores.filter(s=>s.active!==false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</PremiumSelect></div>
      <div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Sana / Savdo</th>{orderedHistoryColumns.map((column)=><th key={column.id} style={historyColumnStyle(column.id)}>{column.label}</th>)}<th/></tr></thead><tbody>{filtered.length?filtered.map(s=><tr key={`${s._source}-${s.id}`}><td data-label="Sana / Savdo"><strong>{s.date||s.dateISO}</strong><small>{s.time||"—"} · {s.id}</small></td>{orderedHistoryColumns.map((column)=>{
        if(column.id==="seller")return <td key={column.id} style={historyColumnStyle(column.id)} data-label={column.label}><strong>{s.sellerName||s.seller||"—"}</strong><small>{s.customer||"Mijoz biriktirilmagan"}</small></td>;
        if(column.id==="store")return <td key={column.id} style={historyColumnStyle(column.id)} data-label={column.label}><strong>{s.store||stores[0]?.name||"—"}</strong><small>{s.shiftId||"Smena ID yo‘q"}</small></td>;
        if(column.id==="payment")return <td key={column.id} style={historyColumnStyle(column.id)} data-label={column.label}><StatusBadge tone="info">{payLabel[s.paymentMethod]||s.paymentMethod}</StatusBadge></td>;
        if(column.id==="gross")return <td key={column.id} style={historyColumnStyle(column.id)} data-label={column.label}>{formatPrice(s.saleTotal||s.total)}</td>;
        if(column.id==="returns")return <td key={column.id} style={historyColumnStyle(column.id)} data-label={column.label}>{Number(s.returnedTotal||0)>0?<StatusBadge tone="warning">-{formatPrice(s.returnedTotal)}</StatusBadge>:"—"}</td>;
        if(column.id==="net")return <td key={column.id} style={historyColumnStyle(column.id)} data-label={column.label}><strong>{formatPrice(net(s))}</strong></td>;
        return null;
      })}<td data-label="Amal"><button className="pro-icon-btn" onClick={()=>setSelected(s)} aria-label="Savdoni ko‘rish"><FiEye/></button></td></tr>):<tr><td colSpan={orderedHistoryColumns.length+2}><div className="pro-empty"><FiShoppingBag/><strong>Savdo topilmadi</strong><span>Filtrlarni o‘zgartirib ko‘ring.</span></div></td></tr>}</tbody></table></div>
    </section>
    <Modal open={!!selected} onClose={()=>setSelected(null)} title={`Savdo ${selected?.id||""}`} subtitle={`${selected?.date||selected?.dateISO||""} · ${selected?.time||""}`} size="lg" footer={<><button className="pro-btn secondary" onClick={()=>window.print()}><FiPrinter/> Chekni qayta chop etish</button><button className="pro-btn primary" disabled={!canReturn||!selected?.items?.some(i=>Number(i.quantity||i.qty||0)>Number(i.returnedQty||0))} onClick={()=>openReturn(selected)}><FiRotateCcw/> Qaytarish</button></>}><div className="sale-detail-kpis"><div><span>Jami</span><strong>{formatPrice(selected?.saleTotal||selected?.total||0)}</strong></div><div><span>Qaytarilgan</span><strong>{formatPrice(selected?.returnedTotal||0)}</strong></div><div><span>Sof</span><strong>{formatPrice(selected?net(selected):0)}</strong></div><div><span>To‘lov</span><strong>{payLabel[selected?.paymentMethod]||"—"}</strong></div></div><div className="sale-detail-items">{selected?.items?.map(i=><div key={i.id||i.productId}><span><strong>{i.name}</strong><small>{i.quantity||i.qty} × {formatPrice(i.finalPrice||i.price)}{i.returnedQty?` · ${i.returnedQty} qaytarilgan`:""}</small></span><b>{formatPrice(Number(i.finalPrice||i.price||0)*Number(i.quantity||i.qty||0))}</b></div>)}</div><div className="history-receipt-print-stack">{Array.from({length:receiptCopies},(_,copyIndex)=><div className={`history-receipt-preview width-${workspaceSettings.receipt.width} ${copyIndex?"history-receipt-copy-extra":""}`} key={`history-receipt-${copyIndex}`}>
      {workspaceSettings.receipt.showLogo&&<><strong>{workspaceSettings.organization.businessName||selected?.store||"Zenix POS"}</strong><small className="history-receipt-powered">Zenix POS</small></>}
      <span>{selected?.store||stores[0]?.name||"Filial"}</span><small>{selected?.id} · {selected?.date||selected?.dateISO} {selected?.time||""}</small>
      <div className="history-receipt-sep"/>{selected?.items?.map((item)=><div className="history-receipt-line" key={`${copyIndex}-${item.id||item.productId}`}><span>{item.name}<small>{item.quantity||item.qty} × {formatPrice(item.finalPrice||item.price)}</small></span><b>{formatPrice(Number(item.finalPrice||item.price||0)*Number(item.quantity||item.qty||0))}</b></div>)}<div className="history-receipt-sep"/>
      <div className="history-receipt-total"><span>JAMI</span><b>{formatPrice(selected?.saleTotal||selected?.total||0)}</b></div>{Number(selected?.returnedTotal||0)>0&&<><div className="history-receipt-summary"><span>Qaytarilgan</span><b>-{formatPrice(selected.returnedTotal)}</b></div><div className="history-receipt-summary"><span>Sof</span><b>{formatPrice(net(selected||{}))}</b></div></>}
      <div className="history-receipt-info">{workspaceSettings.receipt.showPaymentBreakdown&&<span>To‘lov: {payLabel[selected?.paymentMethod]||"—"}</span>}{workspaceSettings.receipt.showCashier&&<span>Kassir: {selected?.sellerName||selected?.seller||"—"}</span>}</div><p>{workspaceSettings.receipt.footer}</p>
    </div>)}</div></Modal>
    <Modal open={!!returnSale} onClose={()=>setReturnSale(null)} title="Qisman qaytarish" subtitle={`${returnSale?.id||""} · qaytariladigan mahsulot va miqdorni tanlang.`} footer={<><button className="pro-btn secondary" onClick={()=>setReturnSale(null)}>Bekor qilish</button><button className="pro-btn danger" disabled={!returnItem||!returnReason||Number(returnQty)<=0} onClick={applyReturn}>Qaytarishni tasdiqlash</button></>}><div className="history-return-products">{returnSale?.items?.map(i=>{const available=Math.max(0,Number(i.quantity||i.qty||0)-Number(i.returnedQty||0));return <button type="button" key={i.id||i.productId} disabled={!available} className={(returnItem?.id||returnItem?.productId)===(i.id||i.productId)?"active":""} onClick={()=>{setReturnItem(i);setReturnQty(1)}}><span><strong>{i.name}</strong><small>{available} dona qaytarish mumkin</small></span><b>{formatPrice(i.finalPrice||i.price)}</b></button>})}</div>{returnItem&&<div className="pro-form-grid history-return-form"><label className="pro-field"><span>Miqdor</span><input type="number" min="1" max={Math.max(1,Number(returnItem.quantity||returnItem.qty||0)-Number(returnItem.returnedQty||0))} value={returnQty} onChange={e=>setReturnQty(e.target.value)}/></label><label className="pro-field"><span>Qaytarish usuli</span><PremiumSelect value={refundMethod} onChange={e=>setRefundMethod(e.target.value)}><option value="original">Asl to‘lov usuli</option><option value="cash">Naqd</option><option value="card">Karta</option><option value="transfer">O‘tkazma</option></PremiumSelect></label><label className="pro-field full"><span>Qaytarish sababi *</span><PremiumSelect value={returnReason} onChange={e=>setReturnReason(e.target.value)}><option value="">Tanlang</option>{RETURN_REASONS.map(reason=><option key={reason}>{reason}</option>)}<option>Boshqa</option></PremiumSelect></label>{returnError&&<div className="pro-alert danger full">{returnError}</div>}</div>}</Modal>
  </div>;
}
export default History;
