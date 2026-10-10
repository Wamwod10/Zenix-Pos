import { useEffect, useRef, useState } from "react";
import { FiCheck, FiCreditCard, FiEye, FiFileText, FiSearch, FiShield, FiUsers, FiX, FiRefreshCw, FiMapPin, FiUserCheck } from "react-icons/fi";
import { useStore } from "../../context/StoreContext";
import { formatPrice } from "../../utils/formatPrice";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, PremiumDateInput, ColumnPicker } from "../../components/Ui";
import Modal from "../../components/Modal";
import { useFeedback } from "../../context/FeedbackContext";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { api } from "../../services/apiClient";
import {PlatformSummary,BusinessDiagnostics,PlatformAudit,RecoveryDashboard} from "./PlatformTools";

const STATUS_LABELS={ACTIVE:"Faol",APPROVED:"Tasdiqlangan",REVIEW:"Tekshiruvda",REJECTED:"Rad etilgan",EXPIRED:"Muddati tugagan",SUSPENDED:"Bloklangan",PAYMENT_REQUIRED:"To‘lov kutilmoqda"};
const tone=status=>status==="ACTIVE"||status==="APPROVED"?"success":status==="REJECTED"||status==="EXPIRED"||status==="SUSPENDED"?"danger":status==="REVIEW"?"warning":"neutral";
const paymentDisplayLabel=payment=>payment?.orderId||["To‘lov",payment?.organization,payment?.submittedAt?new Date(payment.submittedAt).toLocaleDateString("uz-UZ"):""].filter(Boolean).join(" · ");
const paymentColumnDefs=[
  {id:"purpose",label:"Maqsad"},{id:"amount",label:"Summa"},{id:"receipt",label:"Chek"},{id:"status",label:"Holat"},
];
const customerColumnDefs=[
  {id:"owner",label:"Egasi"},{id:"stores",label:"Filiallar"},{id:"plan",label:"Tarif"},{id:"expiry",label:"Muddati"},
];
function PlatformAdmin(){
  const {platformOverview,commitBillingReview,getBillingReceipt,persistenceError,reloadStore,workspaceReady}=useStore();
  const {confirm,notify}=useFeedback();
  const [tab,setTab]=useState("dashboard");
  const [query,setQuery]=useState("");
  const [debouncedQuery,setDebouncedQuery]=useState("");
  const [paymentStatus,setPaymentStatus]=useState("all");
  const [customerStatus,setCustomerStatus]=useState("all");
  const status=tab==="payments"?paymentStatus:customerStatus;
  const setStatus=tab==="payments"?setPaymentStatus:setCustomerStatus;
  const [page,setPage]=useState(1);
  const pageSize=20;
  const [pageRows,setPageRows]=useState([]);
  const [resultTotal,setResultTotal]=useState(0);
  const [pageLoading,setPageLoading]=useState(false);
  const [pageError,setPageError]=useState("");
  const [detailPayments,setDetailPayments]=useState([]);
  const receiptRequestRef=useRef(0);
  const detailRequestRef=useRef(0);
  const detailOrganizationRef=useRef(null);
  useEffect(()=>()=>{detailRequestRef.current+=1;detailOrganizationRef.current=null},[]);
  const [receipt,setReceipt]=useState(null);
  const [receiptUrl,setReceiptUrl]=useState("");
  const [receiptLoading,setReceiptLoading]=useState(false);
  const [detail,setDetail]=useState(null);
  const [detailLoaded,setDetailLoaded]=useState(false);
  const [detailAudit,setDetailAudit]=useState([]);
  const [detailAuditLoading,setDetailAuditLoading]=useState(false);
  const [detailAuditHasMore,setDetailAuditHasMore]=useState(false);
  const [reject,setReject]=useState(null);
  const [reason,setReason]=useState("");
  const [licenseForm,setLicenseForm]=useState({plan:"ANNUAL",expiryDate:"",storeLimit:2,reason:""});
  const [controlBusy,setControlBusy]=useState(false);
  const [promos,setPromos]=useState([]);
  const [promo,setPromo]=useState({code:"",plan:"BOTH",percent:100,maxUses:5,perBusiness:1,startsAt:"",expiresAt:"",active:true});
  const [promoBusy,setPromoBusy]=useState(false);
  const [usage,setUsage]=useState(null);
  const [usageError,setUsageError]=useState("");
  const [recoveryPreview,setRecoveryPreview]=useState(null);
  const [storeQuota,setStoreQuota]=useState(null);
  const [storeHoldReason,setStoreHoldReason]=useState("");
  const [storeHoldBusy,setStoreHoldBusy]=useState(false);
  const [recoveryBusy,setRecoveryBusy]=useState(false);
  const showRecoveryPreview=async()=>{
    if(!detail?.id||recoveryBusy)return;
    const id=detail.id;
    const requestId=detailRequestRef.current;
    setRecoveryBusy(true);
    try{
      const [snapshot,quota]=await Promise.all([
        api.get(`/api/platform/organizations/${encodeURIComponent(id)}/recovery-preview`),
        api.get(`/api/platform/organizations/${encodeURIComponent(id)}/store-reconciliation`),
      ]);
      if(detailRequestRef.current!==requestId)return;
      setRecoveryPreview(snapshot.snapshot?{...snapshot.snapshot,backups:snapshot.backups}:null);
      setStoreQuota(quota.reconciliation||null);
    }catch(error){notify({tone:"danger",title:"Diagnostika yuklanmadi",message:error?.message||"Qayta urining"})}
    finally{setRecoveryBusy(false)};
  };
  const changeStoreHold=async(store,action)=>{
    if(!detail?.id||!store?.id||storeHoldBusy)return;
    if(storeHoldReason.trim().length<10){notify({tone:"danger",title:"Sababni kamida 10 belgi bilan kiriting"});return;}
    const approved=await confirm({title:action==="HOLD"?"Filialda yangi savdolarni cheklash":"Filial savdosini qayta ochish",message:`${store.name}. Eski savdolar va ombor ma’lumotlari o‘chirilmaydi.`,confirmLabel:action==="HOLD"?"Cheklash":"Qayta ochish"});
    if(!approved)return;
    setStoreHoldBusy(true);
    try{
      await api.post(`/api/platform/organizations/${detail.id}/stores/${store.id}/trading-hold`,{action,reason:storeHoldReason.trim()});
      setStoreHoldReason("");await showRecoveryPreview();
      notify({tone:"success",title:action==="HOLD"?"Yangi savdolar cheklangan":"Filial savdosi qayta ochildi"});
    }catch(e){notify({tone:"danger",title:"Filial boshqaruvi",message:e?.message||"Amal bajarilmadi"})}
    finally{setStoreHoldBusy(false)}
  };
  const [resetTarget,setResetTarget]=useState(null);
  const [resetForm,setResetForm]=useState({password:"",reason:""});
  const [resetToken,setResetToken]=useState(null);
  const [resetBusy,setResetBusy]=useState(false);
  const resetRequestRef=useRef(0);
  const closeReset=()=>{resetRequestRef.current+=1;setResetTarget(null);setResetToken(null);setResetBusy(false);setResetForm({password:"",reason:""})};
  const openReset=user=>{resetRequestRef.current+=1;setResetTarget(user);setResetToken(null);setResetBusy(false);setResetForm({password:"",reason:""})};
  useEffect(()=>()=>{resetRequestRef.current+=1},[]);
  const [promoLoading,setPromoLoading]=useState(false);
  const [promoError,setPromoError]=useState('');
  const [promoTotal,setPromoTotal]=useState(0);
  const promoRequestRef=useRef(0);
  const issueResetToken=async()=>{
    if(!detail?.id||!resetTarget||resetBusy)return;
    if(resetForm.reason.trim().length<10){notify({tone:'danger',title:'Shaxsni tekshirish sababini kamida 10 belgi bilan kiriting'});return}
    const request=resetRequestRef.current,organizationId=detail.id,userId=resetTarget.id,reason=resetForm.reason;
    const allowed=await confirm({title:'Shaxs tasdiqlandimi?',message:'Tiklash tokeni 15 daqiqa amal qiladi. Eski sessiyalar bekor qilinadi.',confirmLabel:'Token yaratish'});
    if(!allowed||request!==resetRequestRef.current)return;
    setResetBusy(true);
    try{const result=await api.post(`/api/platform/organizations/${organizationId}/users/${userId}/reset-token`,{reason,identityVerified:true});if(request===resetRequestRef.current)setResetToken(result.reset)}
    catch(e){if(request===resetRequestRef.current)notify({tone:'danger',title:'Tiklash tokeni yaratilmagan',message:e.message})}
    finally{if(request===resetRequestRef.current)setResetBusy(false)}
  };
  const loadPromos=async()=>{
    const request=++promoRequestRef.current;
    setPromoLoading(true);setPromoError('');
    try{const params=new URLSearchParams({q:debouncedQuery,limit:String(pageSize),offset:String((page-1)*pageSize)});const data=await api.get(`/api/platform/promos?${params}`);if(request!==promoRequestRef.current)return;setPromos(data.promos||[]);setPromoTotal(Number(data.total||0))}
    catch(e){if(request===promoRequestRef.current){setPromos([]);setPromoError(e?.message||'Promokodlar yuklanmadi')}}
    finally{if(request===promoRequestRef.current)setPromoLoading(false)}
  };
  const savePromo=async()=>{setPromoBusy(true);try{
    await api.post("/api/platform/promos",{code:promo.code,plan:promo.plan,percent:Number(promo.percent),maxUses:Number(promo.maxUses),perBusiness:Number(promo.perBusiness),startsAt:promo.startsAt?new Date(`${promo.startsAt}T00:00:00+05:00`).toISOString():null,active:promo.active,expiresAt:promo.expiresAt?new Date(`${promo.expiresAt}T23:59:59+05:00`).toISOString():null});
    setPromo(prev=>({...prev,code:""}));await loadPromos();notify({tone:"success",title:"Promokod yaratildi"});
  }catch(e){notify({tone:"danger",title:"Promokod yaratilmagan",message:e?.message||"Xatolik"})}finally{setPromoBusy(false)}};
  const deactivatePromo=async(id)=>{const yes=await confirm({title:"Promokodni to‘xtatish",message:"Bu kodni yangi foydalanishlar uchun o‘chirasizmi?",confirmLabel:"To‘xtatish"});if(!yes)return;try{await api.post(`/api/platform/promos/${id}/deactivate`,{});await loadPromos()}catch(e){notify({tone:"danger",title:"Amal bajarilmadi",message:e.message})}};
  const resetPassword=async()=>{
    if(!detail?.id||!resetTarget||resetBusy)return;
    if(resetForm.password.length<12||resetForm.reason.trim().length<10){notify({tone:"danger",title:"Parol 12 belgi, sabab 10 belgi bo'lishi kerak"});return}
    const request=resetRequestRef.current,organizationId=detail.id,userId=resetTarget.id,form={...resetForm};
    const allowed=await confirm({title:"Xodim parolini tiklash",message:"Mijoz shaxsi tekshirilganmi? Barcha sessiyalar bekor qilinadi.",confirmLabel:"Tiklash"});
    if(!allowed||request!==resetRequestRef.current)return;
    setResetBusy(true);
    try{
      await api.post(`/api/platform/organizations/${organizationId}/users/${userId}/reset-password`,{...form,identityVerified:true});
      if(request!==resetRequestRef.current)return;
      closeReset();notify({tone:"success",title:"Parol tiklandi",message:"Keyingi kirishda yangi parol talab qilinadi."});
    }catch(e){if(request===resetRequestRef.current)notify({tone:"danger",title:"Xato",message:e.message})}
    finally{if(request===resetRequestRef.current)setResetBusy(false)}
  };
  const {visible:paymentColumns,toggle:togglePaymentColumn,show:showPaymentColumn}=usePersistentColumns("zenix_platform_payment_columns",paymentColumnDefs,{required:["status"]});
  const {visible:customerColumns,toggle:toggleCustomerColumn,show:showCustomerColumn}=usePersistentColumns("zenix_platform_customer_columns",customerColumnDefs,{required:["plan"]});
  const totalPages=Math.max(1,Math.ceil((tab==='promos'?promoTotal:resultTotal)/pageSize));
  const pagedRows=pageRows;
  useEffect(()=>{const id=setTimeout(()=>setDebouncedQuery(query),250);return()=>clearTimeout(id)},[query]);
  useEffect(()=>setPage(1),[tab,debouncedQuery,status]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);
  useEffect(()=>{
    if(!workspaceReady||["promos","audit"].includes(tab))return undefined;
    const controller=new AbortController();
    const endpoint=tab==="payments"?"payments":"organizations";
    const params=new URLSearchParams({q:debouncedQuery,status,limit:String(pageSize),offset:String((page-1)*pageSize)});
    setPageRows([]);setPageLoading(true);setPageError("");
    api.get(`/api/platform/${endpoint}/page?${params}`,{signal:controller.signal})
      .then(data=>{if(controller.signal.aborted)return;setPageRows(data.items||[]);setResultTotal(Number(data.total||0))})
      .catch(error=>{if(controller.signal.aborted)return;setPageRows([]);setResultTotal(0);setPageError(error?.message||"Ro‘yxat yuklanmadi")})
      .finally(()=>{if(!controller.signal.aborted)setPageLoading(false)});
    return ()=>controller.abort();
  },[tab,debouncedQuery,status,page,workspaceReady,platformOverview]);
  useEffect(()=>{if(tab==="promos"&&workspaceReady)void loadPromos();return()=>{promoRequestRef.current+=1}},[tab,workspaceReady,debouncedQuery,page]);
  const review=Number(platformOverview?.review||0);
  const active=Number(platformOverview?.active||0);
  const stores=Number(platformOverview?.stores||0);
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
    await reloadStore();
  };

  const openReceipt=async payment=>{
    const requestId=++receiptRequestRef.current;
    setReceipt(payment);setReceiptUrl("");setReceiptLoading(true);
    try{
      const result=await getBillingReceipt(payment.receiptId);
      if(requestId!==receiptRequestRef.current)return; // Ignore stale cheque responses.
      if(result?.success&&result.blob)setReceiptUrl(URL.createObjectURL(result.blob));
      else notify({tone:"danger",title:"Chek ochilmadi",message:result?.message||"Chekni serverdan olib bo‘lmadi."});
    }catch(error){
      if(requestId===receiptRequestRef.current)notify({tone:"danger",title:"Chek ochilmadi",message:error?.message||"Chekni serverdan olib bo‘lmadi."});
    }finally{
      if(requestId===receiptRequestRef.current)setReceiptLoading(false);
    }
  };
  const closeReceipt=()=>{receiptRequestRef.current+=1;setReceiptLoading(false);setReceiptUrl("");setReceipt(null)};
  const openDetail=async(org)=>{closeReset();
    const requestId=++detailRequestRef.current;
    const organizationId=org.id;
    detailOrganizationRef.current=organizationId;
    setUsage(null);setUsageError("");setRecoveryPreview(null);setStoreQuota(null);
    api.get(`/api/platform/organizations/${encodeURIComponent(organizationId)}/usage`).then(data=>{
      if(requestId===detailRequestRef.current&&organizationId===detailOrganizationRef.current&&data?.usage)setUsage(data.usage);
    }).catch(error=>{if(requestId===detailRequestRef.current)setUsageError(error.message||"Hajm yuklanmadi")});
    setDetail(org);setDetailLoaded(false);setDetailPayments([]);setDetailAudit([]);setDetailAuditLoading(true);setDetailAuditHasMore(false);
    setLicenseForm({plan:org.plan||"ANNUAL",expiryDate:String(org.expiryDate||"").slice(0,10),storeLimit:Number(org.storeLimit||2),reason:""});
    try{
      const [detailResult,auditResult]=await Promise.allSettled([
        api.get(`/api/platform/organizations/${encodeURIComponent(org.id)}/detail`),
        api.get(`/api/platform/audit-logs?organizationId=${encodeURIComponent(org.id)}&limit=50`),
      ]);
      if(requestId!==detailRequestRef.current)return;
      if(detailResult.status==="fulfilled"){
        const fresh=detailResult.value.organization||org;
        setDetail(fresh);
        setDetailLoaded(true);
        setLicenseForm({plan:fresh.plan||"ANNUAL",expiryDate:String(fresh.expiryDate||"").slice(0,10),storeLimit:Number(fresh.storeLimit||2),reason:""});
        setDetailPayments(detailResult.value.payments||[]);
      }else notify({tone:"danger",title:"Tashkilot tafsiloti yuklanmadi",message:detailResult.reason?.message||"Ma’lumotni olib bo‘lmadi."});
      if(auditResult.status==="fulfilled"){
        setDetailAudit(auditResult.value.logs||[]);
        setDetailAuditHasMore(Boolean(auditResult.value.hasMore));
      }else notify({tone:"danger",title:"Audit yuklanmadi",message:auditResult.reason?.message||"Audit tarixini olib bo‘lmadi."});
    }finally{if(requestId===detailRequestRef.current)setDetailAuditLoading(false)}
  };
  const loadMoreAudit=async()=>{
    if(!detail?.id||detailAuditLoading||!detailAuditHasMore)return;
    const requestId=detailRequestRef.current,organizationId=detail.id;
    setDetailAuditLoading(true);
    try{
      const response=await api.get(`/api/platform/audit-logs?organizationId=${encodeURIComponent(organizationId)}&limit=50&offset=${detailAudit.length}`);
      if(requestId!==detailRequestRef.current)return;
      const next=response.logs||[];
      setDetailAudit(previous=>[...previous,...next.filter(log=>!previous.some(old=>old.id===log.id))]);
      setDetailAuditHasMore(Boolean(response.hasMore));
    }catch(error){if(requestId===detailRequestRef.current)notify({tone:"danger",title:"Audit yuklanmadi",message:error?.message||"Keyingi yozuvlar yuklanmadi."})}
    finally{if(requestId===detailRequestRef.current)setDetailAuditLoading(false)}
  };
  const closeDetail=()=>{closeReset();detailRequestRef.current+=1;detailOrganizationRef.current=null;setUsage(null);setDetailLoaded(false);setDetailPayments([]);setDetail(null);setDetailAuditLoading(false);setDetailAuditHasMore(false)};
  const controlBusiness=async(action)=>{
    if(!detail?.id||!detailLoaded||controlBusy)return;
    if(licenseForm.reason.trim().length<8){notify({tone:"danger",title:"Sababni kiriting",message:"Kamida 8 ta belgidan iborat izoh yozing."});return}
    const accepted=await confirm({title:"Biznes sozlamalarini o‘zgartirish",message:`${detail.name} · ${action==="SUSPEND"?"Kirishni vaqtincha cheklash":action==="RESTORE"?"Faollikni tiklash":action==="PAYWALL"?"To‘lovgacha bloklash":action==="RELEASE_PAYWALL"?"To‘lov cheklovini yechish":action==="SEND_NOTICE"?"Mijozga ogohlantirish yuborish":"Tarif va filial limitini qo‘lda o‘zgartirish"}. Bu amal audit tarixiga yoziladi.`,confirmLabel:"Tasdiqlash",cancelLabel:"Bekor qilish",tone:"primary"});
    if(!accepted)return;
    setControlBusy(true);
    try{
      const body={action,reason:licenseForm.reason.trim()};
      if(action==="SET_LICENSE")Object.assign(body,{plan:licenseForm.plan,expiryDate:licenseForm.expiryDate,storeLimit:Number(licenseForm.storeLimit)});
      const result=await api.post(`/api/platform/organizations/${encodeURIComponent(detail.id)}/control`,body);
      setDetail(previous=>previous?.id===detail.id?{...previous,...result.organization}:previous);
      setLicenseForm(previous=>({...previous,reason:""}));
      notify({tone:"success",title:"Biznes yangilandi",message:"O‘zgarish auditga yozildi."});
      await reloadStore();
    }catch(error){notify({tone:"danger",title:"Amal bajarilmadi",message:error?.message||"Biznesni yangilab bo‘lmadi."})}
    finally{setControlBusy(false)}
  };

  return <div className="pro-page platform-pro">
    <PageHeader title="Platform boshqaruvi" subtitle="Mijozlar, to‘lov tekshiruvi, tarif va platforma nazorati." actions={<button className="pro-btn secondary" disabled={!workspaceReady} onClick={()=>reloadStore()}><FiRefreshCw/> Yangilash</button>}/>{persistenceError&&<div className="pro-alert danger"><strong>Platforma ma’lumotlari yuklanmadi.</strong><span>{persistenceError}</span><button className="pro-btn secondary" onClick={()=>reloadStore()}>Qayta urinish</button></div>}
    <div className="pro-stat-grid"><StatCard icon={FiUsers} label="Tashkilotlar" value={Number(platformOverview?.organizations||0)} hint="Jami mijozlar" tone="blue"/><StatCard icon={FiShield} label="Faol tariflar" value={active} hint="Faol tashkilotlar" tone="green"/><StatCard icon={FiCreditCard} label="Tekshiruvdagi to‘lovlar" value={review} hint="Tasdiq kutilmoqda" tone="orange"/><StatCard icon={FiFileText} label="Jami filiallar" value={stores} hint="Barcha tashkilotlar" tone="purple"/></div>
    <PlatformSummary overview={platformOverview}/>
    <section className="pro-card"><div className="platform-toolbar"><div className="pro-tabs">{[["dashboard","Dashboard"],["storage","Storage"],["support","Support"],["recovery","Recovery"],["audit","Audit"]].map(([key,label])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}<button className={tab==="payments"?"active":""} onClick={()=>setTab("payments")}>To‘lovlar</button><button className={tab==="customers"?"active":""} onClick={()=>setTab("customers")}>Mijozlar</button><button className={tab==="promos"?"active":""} onClick={()=>setTab("promos")}>Promokodlar</button></div><div className="pro-search"><FiSearch/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Qidirish..."/></div><PremiumSelect className="pro-select" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Barcha holatlar</option>{tab==="payments"?<><option value="REVIEW">Tekshiruvda</option><option value="APPROVED">Tasdiqlangan</option><option value="REJECTED">Rad etilgan</option></>:<><option value="ACTIVE">Faol</option><option value="TRIAL">Sinovda</option><option value="BILLING_HOLD">Billing cheklovi</option><option value="PAYMENT_REQUIRED">To‘lov kutilmoqda</option><option value="REVIEW">Tekshiruvda</option><option value="REJECTED">Rad etilgan</option><option value="EXPIRED">Muddati tugagan</option><option value="SUSPENDED">Bloklangan</option></>}</PremiumSelect><ColumnPicker columns={tab==="payments"?paymentColumnDefs:customerColumnDefs} visible={tab==="payments"?paymentColumns:customerColumns} onToggle={tab==="payments"?togglePaymentColumn:toggleCustomerColumn}/></div>
      {!["promos","audit"].includes(tab)&&<div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead>{tab==="payments"?<tr><th>To‘lov</th><th>Tashkilot</th>{showPaymentColumn("purpose")&&<th>Maqsad</th>}{showPaymentColumn("amount")&&<th>Summa</th>}{showPaymentColumn("receipt")&&<th>Chek</th>}{showPaymentColumn("status")&&<th>Holat</th>}<th>Amal</th></tr>:<tr><th>Tashkilot</th>{showCustomerColumn("owner")&&<th>Egasi</th>}{showCustomerColumn("stores")&&<th>Filiallar</th>}{showCustomerColumn("plan")&&<th>Tarif</th>}{showCustomerColumn("expiry")&&<th>Muddati</th>}<th>Amal</th></tr>}</thead><tbody>{tab==="payments"?resultTotal?pagedRows.map(payment=><tr key={payment.id||payment.orderId}>
        <td data-label="To‘lov"><strong>{paymentDisplayLabel(payment)}</strong><small>{payment.submittedAt?new Date(payment.submittedAt).toLocaleString("uz-UZ"):"—"}</small></td>
        <td data-label="Tashkilot">{payment.organization}</td>
        {showPaymentColumn("purpose")&&<td data-label="Maqsad">{payment.purpose}{payment.servicePeriodFrom&&payment.servicePeriodTo?<small>{payment.servicePeriodFrom} → {payment.servicePeriodTo}</small>:payment.intent==="RENEW"?<small>Uzaytirish</small>:null}</td>}
        {showPaymentColumn("amount")&&<td data-label="Summa"><strong>{formatPrice(payment.amount,"UZS")}</strong></td>}
        {showPaymentColumn("receipt")&&<td data-label="Chek"><button className="pro-btn secondary" disabled={!payment.receiptId} onClick={()=>openReceipt(payment)}><FiEye/> Ko‘rish</button></td>}
        {showPaymentColumn("status")&&<td data-label="Holat"><StatusBadge tone={tone(payment.status)}>{STATUS_LABELS[payment.status]||payment.status}</StatusBadge></td>}
        <td data-label="Amal">{payment.status==="REVIEW"?<div className="pro-row-actions"><button className="pro-icon-btn" title="Tasdiqlash" aria-label="To‘lovni tasdiqlash" onClick={()=>update(payment,"APPROVED")}><FiCheck color="var(--success)"/></button><button className="pro-icon-btn" title="Rad etish" aria-label="To‘lovni rad etish" onClick={()=>setReject(payment)}><FiX color="var(--danger)"/></button></div>:"—"}</td>
      </tr>):<tr><td colSpan={3+paymentColumns.length}><div className="pro-empty"><FiCreditCard/><strong>To‘lov topilmadi</strong></div></td></tr>:pagedRows.map(org=><tr key={org.id}>
        <td data-label="Tashkilot"><strong>{org.name}</strong><small>{org.phone||"Telefon kiritilmagan"}</small></td>
        {showCustomerColumn("owner")&&<td data-label="Egasi"><strong>{org.owner}</strong><small>{org.phone}</small></td>}
        {showCustomerColumn("stores")&&<td data-label="Filiallar">{org.stores}</td>}
        {showCustomerColumn("plan")&&<td data-label="Tarif"><strong>{org.plan||"—"}</strong><StatusBadge tone={tone(org.licenseStatus)}>{STATUS_LABELS[org.licenseStatus]||org.licenseStatus}</StatusBadge>{org.billingHold&&<StatusBadge tone="warning">Billing cheklovi</StatusBadge>}{org.trialEndsAt&&Date.parse(org.trialEndsAt)>Date.now()&&<StatusBadge tone="neutral">Sinovda</StatusBadge>}</td>}
        {showCustomerColumn("expiry")&&<td data-label="Muddati">{org.expiryDate?new Date(org.expiryDate).toLocaleDateString("uz-UZ"):"—"}</td>}
        <td data-label="Amal"><button className="pro-icon-btn" onClick={()=>openDetail(org)} aria-label="Tashkilotni ko‘rish"><FiEye/></button></td>
      </tr>)}{tab!=="payments"&&!["promos","audit"].includes(tab)&&!pagedRows.length&&!pageLoading&&<tr><td colSpan={customerColumns.length+2}><div className="pro-empty"><FiUsers/><strong>Tashkilot topilmadi</strong></div></td></tr>}</tbody></table></div>}{!["promos","audit"].includes(tab)&&resultTotal>pageSize&&<div className="platform-pagination"><span>{resultTotal} ta natija · {page}/{totalPages} sahifa</span><div><button className="pro-btn secondary" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Oldingi</button><button className="pro-btn secondary" disabled={page>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>Keyingi</button></div></div>}
      {pageLoading&&<div className="pro-empty">Ro‘yxat yuklanmoqda...</div>}{pageError&&<div className="pro-alert danger">{pageError}</div>}
    </section>
    {tab==="audit"&&<PlatformAudit/>}
    {tab==="promos"&&<section className="pro-card" style={{padding:18,marginTop:16}}>
      <h2>Promokod yaratish</h2><p>20%, 50%, 75% yoki 100% chegirma. Limit tugasa avtomatik bloklanadi.</p>
      <div className="pro-form-grid">
        <label className="pro-field"><span>Kod</span><input value={promo.code} onChange={e=>setPromo(v=>({...v,code:e.target.value.toUpperCase()}))} placeholder="ZENIX-FREE5"/></label>
        <label className="pro-field"><span>Tarif</span><PremiumSelect value={promo.plan} onChange={e=>setPromo(v=>({...v,plan:e.target.value}))}><option value="BOTH">Oylik va yillik</option><option value="MONTHLY">Oylik</option><option value="ANNUAL">Yillik</option></PremiumSelect></label>
        <label className="pro-field"><span>Chegirma (%)</span><PremiumSelect value={promo.percent} onChange={e=>setPromo(v=>({...v,percent:Number(e.target.value)}))}>{[20,50,75,100].map(v=><option key={v} value={v}>{v}%</option>)}</PremiumSelect></label>
        <label className="pro-field"><span>Umumiy foydalanish limiti</span><input type="number" min="1" value={promo.maxUses} onChange={e=>setPromo(v=>({...v,maxUses:e.target.value}))}/></label>
        <label className="pro-field"><span>Bitta biznes limiti</span><input type="number" min="1" value={promo.perBusiness} onChange={e=>setPromo(v=>({...v,perBusiness:e.target.value}))}/></label>
        <label className="pro-field"><span>Boshlanish sanasi (ixtiyoriy)</span><PremiumDateInput value={promo.startsAt} onChange={e=>setPromo(v=>({...v,startsAt:e.target.value}))}/></label><label className="pro-field"><span>Holat</span><PremiumSelect value={String(promo.active)} onChange={e=>setPromo(v=>({...v,active:e.target.value==="true"}))}><option value="true">Faol</option><option value="false">Faolsiz</option></PremiumSelect></label><label className="pro-field"><span>Oxirgi amal qilish kuni (ixtiyoriy)</span><PremiumDateInput value={promo.expiresAt} onChange={e=>setPromo(v=>({...v,expiresAt:e.target.value}))}/></label>
      </div>
      <button className="pro-btn primary" disabled={promoBusy||promo.code.length<4} onClick={savePromo}>Promokod yaratish</button>
      <div className="pro-table-wrap" style={{marginTop:18}}><table className="pro-table"><thead><tr><th>Kod</th><th>Tarif</th><th>Chegirma</th><th>Foydalanilgan</th><th>Sanalar</th><th>Holat</th><th>Amal</th></tr></thead><tbody>
      {promos.map(item=><tr key={item.id}><td><strong>{item.code}</strong></td><td>{item.plan}</td><td>{item.percent}%</td><td>{item.uses}/{item.maxUses} · band: {item.reserved||0} · qolgan: {item.remaining} (har biznes {item.perBusiness})</td><td>{item.startsAt?new Date(item.startsAt).toLocaleDateString("uz-UZ"):"Darhol"} → {item.expiresAt?new Date(item.expiresAt).toLocaleDateString("uz-UZ"):"Cheksiz"}</td><td>{item.active&&(!item.startsAt||Date.parse(item.startsAt)<=Date.now())&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now())&&item.remaining>0?"Faol":"Yopilgan"}</td><td>{item.active&&<button className="pro-btn secondary" onClick={()=>deactivatePromo(item.id)}>O‘chirish</button>}</td></tr>)}
      </tbody></table></div>{promoLoading&&<div className="pro-empty">Yuklanmoqda...</div>}{promoError&&<div className="pro-alert danger" role="alert">{promoError}</div>}{!promoLoading&&!promoError&&!promos.length&&<div className="pro-empty">Promokod topilmadi</div>}{promoTotal>pageSize&&<div className="platform-pagination"><span>{promoTotal} ta · {page}/{totalPages}</span><button className="pro-btn secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Oldingi</button><button className="pro-btn secondary" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Keyingi</button></div>}
    </section>}
    <Modal open={!!resetTarget} onClose={closeReset} title="Xodim parolini tiklash" subtitle="Eski parolni ko‘rib bo‘lmaydi. Shaxsni tekshirgandan so‘ng vaqtinchalik parol bering." size="sm" footer={<button className="pro-btn primary" onClick={resetPassword}>Parolni tiklash</button>}>
      {resetToken&&<div className="pro-alert" role="status"><strong>Bir martalik token (15 daqiqa)</strong><input readOnly value={resetToken.token} aria-label="Tiklash tokeni"/><small>Mijoz /reset-password sahifasida tokenni kiritadi. {new Date(resetToken.expiresAt).toLocaleString("uz-UZ")} gacha.</small></div>}<button type="button" className="pro-btn secondary" disabled={resetBusy||!!resetToken} onClick={issueResetToken}>{resetBusy?"Yaratilmoqda...":"Bir martalik token yaratish"}</button><label className="pro-field"><span>Vaqtinchalik parol (12+ belgi)</span><input type="password" value={resetForm.password} onChange={e=>setResetForm(v=>({...v,password:e.target.value}))}/></label>
      <label className="pro-field"><span>Sabab / identifikatsiya</span><input value={resetForm.reason} onChange={e=>setResetForm(v=>({...v,reason:e.target.value}))}/></label>
    </Modal>
    <Modal open={!!receipt} onClose={closeReceipt} title="To‘lov cheki" subtitle={paymentDisplayLabel(receipt)} size="sm"><div className="admin-receipt-preview">{receiptLoading?<div className="pro-empty"><FiFileText/><strong>Chek ochilmoqda...</strong></div>:receiptUrl&&receipt?.receiptType?.startsWith("image/")?<img src={receiptUrl} alt="To‘lov cheki" style={{maxWidth:"100%",maxHeight:360,borderRadius:12}}/>:receiptUrl&&receipt?.receiptType==="application/pdf"?<iframe title="PDF chek" src={receiptUrl} style={{width:"100%",height:360,border:0,borderRadius:12}}/>:<FiFileText/>}<strong>{receipt?.receiptName||"To‘lov cheki"}</strong><span>{receipt?.organization}</span><b>{formatPrice(receipt?.amount||0,"UZS")}</b></div>{receipt?.rejectReason&&<div className="pro-alert danger">Rad etish sababi: {receipt.rejectReason}</div>}</Modal>
    <Modal open={!!reject} onClose={()=>setReject(null)} title="To‘lovni rad etish" subtitle="Sabab mijozning Tarif va to‘lovlar sahifasida ko‘rinadi." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setReject(null)}>Bekor qilish</button><button className="pro-btn danger" disabled={!reason.trim()} onClick={()=>update(reject,"REJECTED")}>Rad etish</button></>}><label className="pro-field"><span>Sabab</span><textarea data-modal-autofocus value={reason} onChange={event=>setReason(event.target.value)} placeholder="Masalan: chekdagi summa mos kelmadi"/></label></Modal>
    <Modal open={!!detail} onClose={closeDetail} title={detail?.name||"Mijoz"} subtitle="Tashkilot, xodimlar, filiallar, tarif va to‘lov auditi." size="lg"><div className="supplier-detail-kpis"><div><span>Egasi</span><strong>{detail?.owner||"—"}</strong></div><div><span>Filiallar</span><strong>{detail?.stores||0} / {detail?.effectiveStoreLimit??detail?.storeLimit??0}</strong></div><div><span>Tarif holati</span><strong>{STATUS_LABELS[detail?.licenseStatus]||detail?.licenseStatus}</strong></div></div><section className="pro-card" style={{marginTop:16,marginBottom:16}}><h3 className="detail-subtitle"><FiShield/> Biznes va tarif boshqaruvi</h3><div className="platform-detail-grid"><label className="pro-field"><span>Tarif</span><PremiumSelect className="pro-select" disabled={!detailLoaded} value={licenseForm.plan} onChange={event=>setLicenseForm(prev=>({...prev,plan:event.target.value}))}><option value="MONTHLY">Oylik</option><option value="ANNUAL">Yillik</option></PremiumSelect></label><label className="pro-field"><span>Amal qilish sanasi</span><PremiumDateInput disabled={!detailLoaded} value={licenseForm.expiryDate} onChange={event=>setLicenseForm(prev=>({...prev,expiryDate:event.target.value}))}/></label><label className="pro-field"><span>Filial limiti</span><input type="number" min="1" max="500" disabled={!detailLoaded} value={licenseForm.storeLimit} onChange={event=>setLicenseForm(prev=>({...prev,storeLimit:event.target.value}))}/></label></div><label className="pro-field"><span>O‘zgartirish sababi (audit uchun)</span><textarea disabled={!detailLoaded} value={licenseForm.reason} onChange={event=>setLicenseForm(prev=>({...prev,reason:event.target.value}))} placeholder="Nima sababdan qo‘lda o‘zgartirilmoqda?"/></label><div className="pro-row-actions"><button className="pro-btn secondary" disabled={controlBusy||!detailLoaded||!licenseForm.expiryDate||!licenseForm.reason.trim()} onClick={()=>controlBusiness("SET_LICENSE")}>Tarifni saqlash</button>{detail?.licenseStatus==="SUSPENDED"?<button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("RESTORE")}>Blokdan chiqarish</button>:<button className="pro-btn danger" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("SUSPEND")}>Bloklash</button>}<div className="pro-row-actions" style={{flexWrap:"wrap",marginTop:10}}><button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("SEND_NOTICE")}>To‘lov eslatmasi yuborish</button>{detail?.billingHold?<button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("RELEASE_PAYWALL")}>To‘lov cheklovini yechish</button>:<button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("PAYWALL")}>To‘lovgacha bloklash</button>}</div></div></section>{detailLoaded&&<BusinessDiagnostics key={detail.id} organization={detail} usage={usage} usageError={usageError}/>}<div className="platform-detail-grid"><section><h3 className="detail-subtitle"><FiUserCheck/> Foydalanuvchilar</h3><div className="platform-detail-list">{(detail?.users||[]).length?(detail.users||[]).map(user=><div key={user.id}><span><strong>{user.name}</strong><small>{user.username} · {user.phone||"Telefon yo‘q"}</small></span><span><StatusBadge tone={user.active?"success":"neutral"}>{user.role}</StatusBadge><button className="pro-btn secondary" onClick={()=>openReset(user)}>Parolni tiklash</button></span></div>):<div className="pro-empty"><FiUsers/><strong>Foydalanuvchi topilmadi</strong></div>}</div></section><section><h3 className="detail-subtitle"><FiMapPin/> Filiallar</h3><div className="platform-detail-list">{(detail?.storeRows||[]).length?(detail.storeRows||[]).map(store=><div key={store.id}><span><strong>{store.name}</strong><small>{store.createdAt?new Date(store.createdAt).toLocaleDateString("uz-UZ"):"—"}</small></span><StatusBadge tone={store.active?"success":"neutral"}>{store.active?"Faol":"Arxiv"}</StatusBadge></div>):<div className="pro-empty"><FiMapPin/><strong>Filial topilmadi</strong></div>}</div></section></div>{(detail?.extraStoreEntitlements||[]).length>0&&<><h3 className="detail-subtitle">Qo‘shimcha filial obunalari</h3><div className="platform-detail-list">{detail.extraStoreEntitlements.map(pass=><div key={pass.id}><span><strong>{pass.quantity} ta · {pass.duration==="MONTHLY"?"1 oy":pass.duration==="ANNUAL"?"1 yil":"Tarif tugaguncha"}</strong><small>{String(pass.startsOn||"").slice(0,10)} → {String(pass.expiresOn||"").slice(0,10)}</small></span><StatusBadge tone={pass.active?"success":"neutral"}>{pass.active?"Faol":"Tugagan"}</StatusBadge></div>)}</div></>}<section className="pro-card" style={{marginTop:16,marginBottom:16}}>
      <h3 className="detail-subtitle"><FiShield/> Tiklash va filial limitlari diagnostikasi</h3><p>Provider metadata va restore readiness quyida alohida tekshiriladi.</p>
      <p className="pro-muted">Faqat o‘qish rejimi. Bu bo‘lim ma’lumotlarni o‘chirmaydi yoki avtomatik tiklamaydi.</p>
      <button className="pro-btn secondary" disabled={!detailLoaded||recoveryBusy} onClick={showRecoveryPreview}>{recoveryBusy?"Tekshirilmoqda...":"Tekshirish"}</button>
      {storeQuota&&<div className="platform-detail-list" style={{marginTop:12}}>
        <div><span>Faol filiallar / joriy limit</span><strong>{storeQuota.activeStores} / {storeQuota.effectiveLimit}</strong></div>
        {storeQuota.needsReconciliation&&<div><span>Limitdan ortiq filiallar (yangi savdo cheklanadi)</span><strong>{storeQuota.overLimit} ta</strong></div>}
        <div><span>Filial cheklovlari</span><strong>Ortiqcha filialda yangi savdo bloklanadi, ma’lumotlar saqlanadi</strong></div>
        <label className="pro-field"><span>Amal sababi (kamida 10 belgi)</span><textarea value={storeHoldReason} onChange={e=>setStoreHoldReason(e.target.value)} placeholder="Masalan: qo‘shimcha filial to‘lovi tugagan, mijoz ogohlantirildi"/></label>
        {(detail?.storeRows||[]).filter(store=>store.active).map(store=>{const held=(storeQuota.heldStoreIds||[]).includes(store.id);const paidLimitExpired=(storeQuota.tradingRestrictedStoreIds||[]).includes(store.id);return <div key={store.id}><span><strong>{store.name}</strong><small>{paidLimitExpired?"Filial obunasi tugagan — yangi savdo bloklangan":held?"Admin tomonidan cheklangan":"Yangi savdolar ochiq"}</small></span><button className={`pro-btn ${held?"secondary":"danger"}`} disabled={paidLimitExpired||storeHoldBusy||!detailLoaded||storeHoldReason.trim().length<10} onClick={()=>changeStoreHold(store,held?"RELEASE":"HOLD")}>{paidLimitExpired?"Billing orqali uzaytiring":held?"Qayta ochish":"Savdoni cheklash"}</button></div>})}
      </div>}
      {recoveryPreview&&<div className="platform-detail-list" style={{marginTop:12}}>
        <RecoveryDashboard organizationId={detail.id} initialHistory={recoveryPreview.backups}/>
        {Object.entries(recoveryPreview.metrics||{}).map(([name,metric])=><div key={name}><span>{name}</span><strong>{metric.rows} yozuv</strong></div>)}
      </div>}
    </section><h3 className="detail-subtitle">To‘lov tarixi</h3><div className="platform-detail-list">{detailPayments.map(item=><div key={item.id}><span><strong>{item.purpose}</strong><small>{item.submittedAt?new Date(item.submittedAt).toLocaleString("uz-UZ"):"—"}</small></span><span><b>{formatPrice(item.amount,"UZS")}</b><StatusBadge tone={tone(item.status)}>{STATUS_LABELS[item.status]||item.status}</StatusBadge></span></div>)}{!detailPayments.length&&<div className="pro-empty"><FiCreditCard/><strong>To‘lov tarixi yo‘q</strong></div>}</div><h3 className="detail-subtitle">Audit</h3><div className="admin-timeline">{detailAuditLoading?<div><i/><span><strong>Audit yuklanmoqda...</strong></span></div>:detailAudit.length?detailAudit.map(log=><div key={log.id}><i/><span><strong>{log.title||log.action}</strong><small>{[log.userName,log.storeName,log.description].filter(Boolean).join(" · ")} · {log.createdAt?new Date(log.createdAt).toLocaleString("uz-UZ"):"—"}</small></span></div>):<div><i/><span><strong>Audit yozuvi topilmadi</strong><small>Bu tashkilot uchun server audit logi hali yo‘q.</small></span></div>}</div>{detailAuditHasMore&&<button className="pro-btn secondary" disabled={detailAuditLoading} onClick={loadMoreAudit}>Yana 50 ta audit yozuvi</button>}</Modal>
  </div>;
}
export default PlatformAdmin;
