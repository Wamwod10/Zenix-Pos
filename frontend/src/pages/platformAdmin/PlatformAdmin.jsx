import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiCreditCard, FiEye, FiFileText, FiSearch, FiShield, FiUsers, FiX, FiRefreshCw, FiMapPin, FiUserCheck } from "react-icons/fi";
import { useStore } from "../../context/StoreContext";
import { formatPrice } from "../../utils/formatPrice";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, ColumnPicker } from "../../components/Ui";
import Modal from "../../components/Modal";
import { useFeedback } from "../../context/FeedbackContext";
import usePersistentColumns from "../../utils/usePersistentColumns";

const STATUS_LABELS={ACTIVE:"Faol",APPROVED:"Tasdiqlangan",REVIEW:"Tekshiruvda",REJECTED:"Rad etilgan",EXPIRED:"Muddati tugagan",PAYMENT_REQUIRED:"To‘lov kutilmoqda"};
const tone=status=>status==="ACTIVE"||status==="APPROVED"?"success":status==="REJECTED"||status==="EXPIRED"?"danger":status==="REVIEW"?"warning":"neutral";
const paymentColumnDefs=[
  {id:"purpose",label:"Maqsad"},{id:"amount",label:"Summa"},{id:"receipt",label:"Chek"},{id:"status",label:"Holat"},
];
const customerColumnDefs=[
  {id:"owner",label:"Egasi"},{id:"stores",label:"Filiallar"},{id:"plan",label:"Tarif"},{id:"expiry",label:"Muddati"},
];
function PlatformAdmin(){
  const {organizations,payments,commitBillingReview,getBillingReceipt,persistenceError,reloadStore,workspaceReady}=useStore();
  const {confirm,notify}=useFeedback();
  const [tab,setTab]=useState("payments");
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [page,setPage]=useState(1);
  const pageSize=20;
  const [receipt,setReceipt]=useState(null);
  const [receiptUrl,setReceiptUrl]=useState("");
  const [receiptLoading,setReceiptLoading]=useState(false);
  const [detail,setDetail]=useState(null);
  const [reject,setReject]=useState(null);
  const [reason,setReason]=useState("");
  const {visible:paymentColumns,toggle:togglePaymentColumn,show:showPaymentColumn}=usePersistentColumns("zenix_platform_payment_columns",paymentColumnDefs,{required:["status"]});
  const {visible:customerColumns,toggle:toggleCustomerColumn,show:showCustomerColumn}=usePersistentColumns("zenix_platform_customer_columns",customerColumnDefs,{required:["plan"]});
  const orgs=useMemo(()=>organizations.filter(org=>`${org.name} ${org.owner} ${org.phone}`.toLowerCase().includes(query.toLowerCase())&&(status==="all"||org.licenseStatus===status)),[organizations,query,status]);
  const payRows=useMemo(()=>payments.filter(payment=>`${payment.organization} ${payment.id||payment.orderId} ${payment.purpose}`.toLowerCase().includes(query.toLowerCase())&&(status==="all"||payment.status===status)),[payments,query,status]);
  const activeRows=tab==="payments"?payRows:orgs;
  const totalPages=Math.max(1,Math.ceil(activeRows.length/pageSize));
  const pagedRows=activeRows.slice((page-1)*pageSize,page*pageSize);
  useEffect(()=>setPage(1),[tab,query,status]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);
  const review=payments.filter(payment=>payment.status==="REVIEW").length;
  const active=organizations.filter(org=>org.licenseStatus==="ACTIVE").length;
  const stores=organizations.reduce((sum,org)=>sum+Number(org.stores||0),0);
  useEffect(()=>()=>{if(receiptUrl&&!receiptUrl.startsWith("data:"))URL.revokeObjectURL(receiptUrl)},[receiptUrl]);

  const update=async(payment,next)=>{
    if(next==="APPROVED"){
      const accepted=await confirm({
        title:"To‘lovni tasdiqlaysizmi?",
        message:`${payment.organization||"Mijoz"} · ${formatPrice(payment.amount||0,"UZS")}. Tasdiqlangach tarif yoki filial limiti darhol yangilanadi.`,
        confirmLabel:"Tasdiqlash",
        cancelLabel:"Bekor qilish",
        tone:"primary",
      });
      if(!accepted)return;
    }
    const result=await commitBillingReview({
      paymentId:payment.id||payment.orderId,
      status:next,
      reason,
    });
    if(!result?.success){
      notify({tone:"danger",title:"Amal bajarilmadi",message:result?.message||"To‘lov holatini yangilab bo‘lmadi."});
      return;
    }
    notify({
      tone:next==="APPROVED"?"success":"warning",
      title:next==="APPROVED"?"To‘lov tasdiqlandi":"To‘lov rad etildi",
      message:payment.organization||payment.orderId||"To‘lov",
    });
    setReject(null);
    setReason("");
  };

  const openReceipt=async payment=>{
    if(receiptUrl&&!receiptUrl.startsWith("data:"))URL.revokeObjectURL(receiptUrl);
    setReceipt(payment);setReceiptUrl("");setReceiptLoading(true);
    const result=await getBillingReceipt(payment.receiptId);
    if(result?.success&&result.blob)setReceiptUrl(URL.createObjectURL(result.blob));
    else if(!result?.success)notify({tone:"danger",title:"Chek ochilmadi",message:result?.message||"Chekni serverdan olib bo‘lmadi."});
    setReceiptLoading(false);
  };
  const closeReceipt=()=>{if(receiptUrl&&!receiptUrl.startsWith("data:"))URL.revokeObjectURL(receiptUrl);setReceiptUrl("");setReceipt(null)};

  return <div className="pro-page platform-pro">
    <PageHeader title="Platform boshqaruvi" subtitle="Mijozlar, to‘lov tekshiruvi, tarif va platforma nazorati." actions={<button className="pro-btn secondary" disabled={!workspaceReady} onClick={()=>reloadStore()}><FiRefreshCw/> Yangilash</button>}/>{persistenceError&&<div className="pro-alert danger"><strong>Platforma ma’lumotlari yuklanmadi.</strong><span>{persistenceError}</span><button className="pro-btn secondary" onClick={()=>reloadStore()}>Qayta urinish</button></div>}
    <div className="pro-stat-grid"><StatCard icon={FiUsers} label="Tashkilotlar" value={organizations.length} hint="Jami mijozlar" tone="blue"/><StatCard icon={FiShield} label="Faol tariflar" value={active} hint="Faol tashkilotlar" tone="green"/><StatCard icon={FiCreditCard} label="Tekshiruvdagi to‘lovlar" value={review} hint="Tasdiq kutilmoqda" tone="orange"/><StatCard icon={FiFileText} label="Jami filiallar" value={stores} hint="Barcha tashkilotlar" tone="purple"/></div>
    <section className="pro-card"><div className="platform-toolbar"><div className="pro-tabs"><button className={tab==="payments"?"active":""} onClick={()=>setTab("payments")}>To‘lovlar</button><button className={tab==="customers"?"active":""} onClick={()=>setTab("customers")}>Mijozlar</button></div><div className="pro-search"><FiSearch/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Qidirish..."/></div><PremiumSelect className="pro-select" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Barcha holatlar</option>{tab==="payments"?<><option value="REVIEW">Tekshiruvda</option><option value="APPROVED">Tasdiqlangan</option><option value="REJECTED">Rad etilgan</option></>:<><option value="ACTIVE">Faol</option><option value="REVIEW">Tekshiruvda</option><option value="REJECTED">Rad etilgan</option><option value="EXPIRED">Muddati tugagan</option></>}</PremiumSelect><ColumnPicker columns={tab==="payments"?paymentColumnDefs:customerColumnDefs} visible={tab==="payments"?paymentColumns:customerColumns} onToggle={tab==="payments"?togglePaymentColumn:toggleCustomerColumn}/></div>
      <div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead>{tab==="payments"?<tr><th>To‘lov</th><th>Tashkilot</th>{showPaymentColumn("purpose")&&<th>Maqsad</th>}{showPaymentColumn("amount")&&<th>Summa</th>}{showPaymentColumn("receipt")&&<th>Chek</th>}{showPaymentColumn("status")&&<th>Holat</th>}<th>Amal</th></tr>:<tr><th>Tashkilot</th>{showCustomerColumn("owner")&&<th>Egasi</th>}{showCustomerColumn("stores")&&<th>Filiallar</th>}{showCustomerColumn("plan")&&<th>Tarif</th>}{showCustomerColumn("expiry")&&<th>Muddati</th>}<th>Amal</th></tr>}</thead><tbody>{tab==="payments"?payRows.length?pagedRows.map(payment=><tr key={payment.id||payment.orderId}>
        <td data-label="To‘lov"><strong>{payment.orderId||payment.id}</strong><small>{payment.submittedAt?new Date(payment.submittedAt).toLocaleString("uz-UZ"):"—"}</small></td>
        <td data-label="Tashkilot">{payment.organization}</td>
        {showPaymentColumn("purpose")&&<td data-label="Maqsad">{payment.purpose}{payment.servicePeriodFrom&&payment.servicePeriodTo?<small>{payment.servicePeriodFrom} → {payment.servicePeriodTo}</small>:payment.intent==="RENEW"?<small>Uzaytirish</small>:null}</td>}
        {showPaymentColumn("amount")&&<td data-label="Summa"><strong>{formatPrice(payment.amount,"UZS")}</strong></td>}
        {showPaymentColumn("receipt")&&<td data-label="Chek"><button className="pro-btn secondary" onClick={()=>openReceipt(payment)}><FiEye/> Ko‘rish</button></td>}
        {showPaymentColumn("status")&&<td data-label="Holat"><StatusBadge tone={tone(payment.status)}>{STATUS_LABELS[payment.status]||payment.status}</StatusBadge></td>}
        <td data-label="Amal">{payment.status==="REVIEW"?<div className="pro-row-actions"><button className="pro-icon-btn" title="Tasdiqlash" aria-label="To‘lovni tasdiqlash" onClick={()=>update(payment,"APPROVED")}><FiCheck color="var(--success)"/></button><button className="pro-icon-btn" title="Rad etish" aria-label="To‘lovni rad etish" onClick={()=>setReject(payment)}><FiX color="var(--danger)"/></button></div>:"—"}</td>
      </tr>):<tr><td colSpan={3+paymentColumns.length}><div className="pro-empty"><FiCreditCard/><strong>To‘lov topilmadi</strong></div></td></tr>:pagedRows.map(org=><tr key={org.id}>
        <td data-label="Tashkilot"><strong>{org.name}</strong><small>{org.id}</small></td>
        {showCustomerColumn("owner")&&<td data-label="Egasi"><strong>{org.owner}</strong><small>{org.phone}</small></td>}
        {showCustomerColumn("stores")&&<td data-label="Filiallar">{org.stores}</td>}
        {showCustomerColumn("plan")&&<td data-label="Tarif"><StatusBadge tone={tone(org.licenseStatus)}>{STATUS_LABELS[org.licenseStatus]||org.licenseStatus}</StatusBadge></td>}
        {showCustomerColumn("expiry")&&<td data-label="Muddati">{org.expiryDate?new Date(org.expiryDate).toLocaleDateString("uz-UZ"):"—"}</td>}
        <td data-label="Amal"><button className="pro-icon-btn" onClick={()=>setDetail(org)} aria-label="Tashkilotni ko‘rish"><FiEye/></button></td>
      </tr>)}</tbody></table></div>{activeRows.length>pageSize&&<div className="platform-pagination"><span>{activeRows.length} ta natija · {page}/{totalPages} sahifa</span><div><button className="pro-btn secondary" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Oldingi</button><button className="pro-btn secondary" disabled={page>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>Keyingi</button></div></div>}
    </section>
    <Modal open={!!receipt} onClose={closeReceipt} title="To‘lov cheki" subtitle={receipt?.orderId||receipt?.id} size="sm"><div className="admin-receipt-preview">{receiptLoading?<div className="pro-empty"><FiFileText/><strong>Chek ochilmoqda...</strong></div>:receiptUrl&&receipt?.receiptType?.startsWith("image/")?<img src={receiptUrl} alt="To‘lov cheki" style={{maxWidth:"100%",maxHeight:360,borderRadius:12}}/>:receiptUrl&&receipt?.receiptType==="application/pdf"?<iframe title="PDF chek" src={receiptUrl} style={{width:"100%",height:360,border:0,borderRadius:12}}/>:<FiFileText/>}<strong>{receipt?.receiptName||"To‘lov cheki"}</strong><span>{receipt?.organization}</span><b>{formatPrice(receipt?.amount||0,"UZS")}</b></div>{receipt?.rejectReason&&<div className="pro-alert danger">Rad etish sababi: {receipt.rejectReason}</div>}</Modal>
    <Modal open={!!reject} onClose={()=>setReject(null)} title="To‘lovni rad etish" subtitle="Sabab mijozning Tarif va to‘lovlar sahifasida ko‘rinadi." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setReject(null)}>Bekor qilish</button><button className="pro-btn danger" disabled={!reason.trim()} onClick={()=>update(reject,"REJECTED")}>Rad etish</button></>}><label className="pro-field"><span>Sabab</span><textarea data-modal-autofocus value={reason} onChange={event=>setReason(event.target.value)} placeholder="Masalan: chekdagi summa mos kelmadi"/></label></Modal>
    <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?.name||"Mijoz"} subtitle="Tashkilot, xodimlar, filiallar, tarif va to‘lov auditi." size="lg"><div className="supplier-detail-kpis"><div><span>Egasi</span><strong>{detail?.owner||"—"}</strong></div><div><span>Filiallar</span><strong>{detail?.stores||0} / {detail?.storeLimit||0}</strong></div><div><span>Tarif holati</span><strong>{STATUS_LABELS[detail?.licenseStatus]||detail?.licenseStatus}</strong></div></div><div className="platform-detail-grid"><section><h3 className="detail-subtitle"><FiUserCheck/> Foydalanuvchilar</h3><div className="platform-detail-list">{(detail?.users||[]).length?(detail.users||[]).map(user=><div key={user.id}><span><strong>{user.name}</strong><small>{user.username} · {user.phone||"Telefon yo‘q"}</small></span><StatusBadge tone={user.active?"success":"neutral"}>{user.role}</StatusBadge></div>):<div className="pro-empty"><FiUsers/><strong>Foydalanuvchi topilmadi</strong></div>}</div></section><section><h3 className="detail-subtitle"><FiMapPin/> Filiallar</h3><div className="platform-detail-list">{(detail?.storeRows||[]).length?(detail.storeRows||[]).map(store=><div key={store.id}><span><strong>{store.name}</strong><small>{store.createdAt?new Date(store.createdAt).toLocaleDateString("uz-UZ"):"—"}</small></span><StatusBadge tone={store.active?"success":"neutral"}>{store.active?"Faol":"Arxiv"}</StatusBadge></div>):<div className="pro-empty"><FiMapPin/><strong>Filial topilmadi</strong></div>}</div></section></div><h3 className="detail-subtitle">To‘lov tarixi</h3><div className="platform-detail-list">{payments.filter(item=>String(item.organizationId)===String(detail?.id)).slice(0,20).map(item=><div key={item.id}><span><strong>{item.purpose}</strong><small>{item.submittedAt?new Date(item.submittedAt).toLocaleString("uz-UZ"):"—"}</small></span><span><b>{formatPrice(item.amount,"UZS")}</b><StatusBadge tone={tone(item.status)}>{STATUS_LABELS[item.status]||item.status}</StatusBadge></span></div>)}{!payments.some(item=>String(item.organizationId)===String(detail?.id))&&<div className="pro-empty"><FiCreditCard/><strong>To‘lov tarixi yo‘q</strong></div>}</div><h3 className="detail-subtitle">Audit</h3><div className="admin-timeline"><div><i/><span><strong>Tashkilot yaratildi</strong><small>{detail?.createdAt?new Date(detail.createdAt).toLocaleString("uz-UZ"):"—"}</small></span></div><div><i/><span><strong>Joriy tarif holati</strong><small>{STATUS_LABELS[detail?.licenseStatus]||detail?.licenseStatus}</small></span></div><div><i/><span><strong>Muddati</strong><small>{detail?.expiryDate?new Date(detail.expiryDate).toLocaleDateString("uz-UZ"):"Belgilanmagan"}</small></span></div></div></Modal>
  </div>;
}
export default PlatformAdmin;
