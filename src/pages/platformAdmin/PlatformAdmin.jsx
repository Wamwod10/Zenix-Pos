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

const STATUS_LABELS={ACTIVE:"Faol",APPROVED:"Tasdiqlangan",REVIEW:"Tekshiruvda",REJECTED:"Rad etilgan",EXPIRED:"Muddati tugagan",SUSPENDED:"Bloklangan",PAYMENT_REQUIRED:"To‘lov kutilmoqda",TRIAL:"Sinovda",BILLING_HOLD:"To‘lov cheklovi"};
const tone=status=>status==="ACTIVE"||status==="APPROVED"?"success":status==="REJECTED"||status==="EXPIRED"||status==="SUSPENDED"?"danger":status==="REVIEW"||status==="BILLING_HOLD"||status==="PAYMENT_REQUIRED"?"warning":"neutral";
const planLabel=plan=>({MONTHLY:"Oylik",ANNUAL:"Yillik",BOTH:"Oylik va yillik"})[plan]||plan||"—";
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
  const sectionKeys=["dashboard","customers","payments","promos","storage","support","recovery","audit"];
  const [tab,setTab]=useState(()=>{const value=new URLSearchParams(window.location.search).get("section");return sectionKeys.includes(value)?value:"dashboard"});
  useEffect(()=>{const pop=()=>{const value=new URLSearchParams(window.location.search).get("section");setTab(sectionKeys.includes(value)?value:"dashboard")};window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop)},[]);
  const [query,setQuery]=useState("");
  const changeTab=(next)=>{if(next===tab)return;const url=new URL(window.location.href);url.searchParams.set("section",next);window.history.pushState(window.history.state,"",url.pathname+url.search+url.hash);setTab(next);setQuery("");setPage(1);};
  const [debouncedQuery,setDebouncedQuery]=useState("");
  const [paymentStatus,setPaymentStatus]=useState("all");
  const [customerStatus,setCustomerStatus]=useState("all");
  const status=tab==="payments"?paymentStatus:customerStatus;
  const setStatus=tab==="payments"?setPaymentStatus:setCustomerStatus;
  const [page,setPage]=useState(1);
  const [moreMetrics,setMoreMetrics]=useState(false);
  const [promoFormOpen,setPromoFormOpen]=useState(false);
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
  const [receiptZoom,setReceiptZoom]=useState(false);
  const [detail,setDetail]=useState(null);
  const [detailLoaded,setDetailLoaded]=useState(false);
  const [detailSection,setDetailSection]=useState("overview");
  const [detailDiagnosticTab,setDetailDiagnosticTab]=useState("business");
  const [detailError,setDetailError]=useState("");
  const [detailUserQuery,setDetailUserQuery]=useState("");
  const diagnosticsTabs=[["business","Biznes"],["storage","Saqlash"],["support","Yordam"],["recovery","Tiklash"]];
  const [visibleAuditCount,setVisibleAuditCount]=useState(20);
  const detailTabs=[["overview","Umumiy"],["license","Tarif"],["users","Xodimlar"],["stores","Filiallar"],["diagnostics","Diagnostika"],["payments","To‘lovlar"],["audit","Audit"]];
  const selectDetailTab=(next)=>{setDetailSection(next);document.querySelector(".platform-customer-modal .pro-modal-body")?.scrollTo?.({top:0,behavior:"instant"})};
  const onDetailTabKeyDown=(event,index)=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?detailTabs.length-1:(index+(event.key==="ArrowRight"?1:-1)+detailTabs.length)%detailTabs.length;selectDetailTab(detailTabs[next][0]);event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus()};
  const onDiagnosticsKeyDown=(event,index)=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?diagnosticsTabs.length-1:(index+(event.key==="ArrowRight"?1:-1)+diagnosticsTabs.length)%diagnosticsTabs.length;setDetailDiagnosticTab(diagnosticsTabs[next][0]);event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus()};
  const [detailAudit,setDetailAudit]=useState([]);
  const [detailAuditLoading,setDetailAuditLoading]=useState(false);
  const [detailAuditHasMore,setDetailAuditHasMore]=useState(false);
  const [reject,setReject]=useState(null);
  const [reason,setReason]=useState("");
  // Lock synchronously, before the async confirmation opens, so rapid clicks
  // cannot launch duplicate reviews while React has not yet re-rendered.
  const reviewInFlightRef=useRef(null);
  const [reviewBusyId,setReviewBusyId]=useState(null);
  const [licenseForm,setLicenseForm]=useState({plan:"ANNUAL",expiryDate:"",storeLimit:2,reason:""});
  const [controlBusy,setControlBusy]=useState(false);
  const controlInFlightRef=useRef(false);
  const [promos,setPromos]=useState([]);
  const [promo,setPromo]=useState({code:"",plan:"BOTH",percent:100,maxUses:5,perBusiness:1,startsAt:"",expiresAt:"",active:true});
  const [promoBusy,setPromoBusy]=useState(false);
  const promoActionRef=useRef(false);
  const [usage,setUsage]=useState(null);
  const [usageError,setUsageError]=useState("");
  const [recoveryPreview,setRecoveryPreview]=useState(null);
  const [storeQuota,setStoreQuota]=useState(null);
  const [storeHoldReason,setStoreHoldReason]=useState("");
  const [storeHoldBusy,setStoreHoldBusy]=useState(false);
  const storeHoldInFlightRef=useRef(false);
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
    }catch(error){if(detailRequestRef.current===requestId)notify({tone:"danger",title:"Diagnostika yuklanmadi",message:error?.message||"Qayta urining"})}
    finally{if(detailRequestRef.current===requestId)setRecoveryBusy(false)};
  };
  const changeStoreHold=async(store,action)=>{
    if(!detail?.id||!store?.id||storeHoldBusy||storeHoldInFlightRef.current)return;
    const reason=storeHoldReason.trim();
    if(reason.length<10){notify({tone:"danger",title:"Sababni kamida 10 belgi bilan kiriting"});return;}
    const organizationId=detail.id,storeId=store.id,storeName=store.name;
    // The lock must be acquired before the async confirmation can be opened twice.
    storeHoldInFlightRef.current=true;
    setStoreHoldBusy(true);
    try{
      const approved=await confirm({title:action==="HOLD"?"Filialda yangi savdolarni cheklash":"Filial savdosini qayta ochish",message:`${storeName}. Eski savdolar va ombor ma’lumotlari o‘chirilmaydi.`,confirmLabel:action==="HOLD"?"Cheklash":"Qayta ochish"});
      if(!approved)return;
      await api.post(`/api/platform/organizations/${encodeURIComponent(organizationId)}/stores/${encodeURIComponent(storeId)}/trading-hold`,{action,reason});
      setStoreHoldReason("");await showRecoveryPreview();
      notify({tone:"success",title:action==="HOLD"?"Yangi savdolar cheklangan":"Filial savdosi qayta ochildi"});
    }catch(e){notify({tone:"danger",title:"Filial boshqaruvi",message:e?.message||"Amal bajarilmadi"})}
    finally{storeHoldInFlightRef.current=false;setStoreHoldBusy(false)}
  };
  const [resetTarget,setResetTarget]=useState(null);
  const [resetForm,setResetForm]=useState({password:"",reason:""});
  const [resetToken,setResetToken]=useState(null);
  const [resetBusy,setResetBusy]=useState(false);
  const [resetMode,setResetMode]=useState("token");
  const resetRequestRef=useRef(0);
  const resetActionInFlightRef=useRef(null);
  const closeReset=()=>{resetRequestRef.current+=1;resetActionInFlightRef.current=null;setResetTarget(null);setResetToken(null);setResetMode("token");setResetBusy(false);setResetForm({password:"",reason:""})};
  const openReset=user=>{resetRequestRef.current+=1;resetActionInFlightRef.current=null;setResetTarget(user);setResetToken(null);setResetMode("token");setResetBusy(false);setResetForm({password:"",reason:""})};
  useEffect(()=>()=>{resetRequestRef.current+=1},[]);
  const [promoLoading,setPromoLoading]=useState(false);
  const [promoError,setPromoError]=useState('');
  const [promoTotal,setPromoTotal]=useState(0);
  const promoRequestRef=useRef(0);
  const issueResetToken=async()=>{
    if(!detail?.id||!resetTarget||resetBusy||resetActionInFlightRef.current)return;
    if(resetForm.reason.trim().length<10){notify({tone:'danger',title:'Shaxsni tekshirish sababini kamida 10 belgi bilan kiriting'});return}
    const request=resetRequestRef.current,organizationId=detail.id,userId=resetTarget.id,reason=resetForm.reason;
    const lock={};
    resetActionInFlightRef.current=lock;
    setResetBusy(true);
    try{
      const allowed=await confirm({title:'Shaxs tasdiqlandimi?',message:'Tiklash tokeni 15 daqiqa amal qiladi. Eski sessiyalar bekor qilinadi.',confirmLabel:'Token yaratish'});
      if(!allowed||request!==resetRequestRef.current)return;
      const result=await api.post(`/api/platform/organizations/${organizationId}/users/${userId}/reset-token`,{reason,identityVerified:true});
      if(request===resetRequestRef.current)setResetToken(result.reset);
    }catch(e){if(request===resetRequestRef.current)notify({tone:'danger',title:'Tiklash tokeni yaratilmagan',message:e.message})}
    finally{if(resetActionInFlightRef.current===lock)resetActionInFlightRef.current=null;if(request===resetRequestRef.current)setResetBusy(false)}
  };
  const loadPromos=async()=>{
    const request=++promoRequestRef.current;
    setPromoLoading(true);setPromoError('');
    try{const params=new URLSearchParams({q:debouncedQuery,limit:String(pageSize),offset:String((page-1)*pageSize)});const data=await api.get(`/api/platform/promos?${params}`);if(request!==promoRequestRef.current)return;setPromos(data.promos||[]);setPromoTotal(Number(data.total||0))}
    catch(e){if(request===promoRequestRef.current){setPromos([]);setPromoError(e?.message||'Promokodlar yuklanmadi')}}
    finally{if(request===promoRequestRef.current)setPromoLoading(false)}
  };
  const savePromo=async()=>{
    if(promoActionRef.current)return;
    promoActionRef.current=true;
    setPromoBusy(true);
    const form={...promo};
    try{
      await api.post("/api/platform/promos",{code:form.code,plan:form.plan,percent:Number(form.percent),maxUses:Number(form.maxUses),perBusiness:Number(form.perBusiness),startsAt:form.startsAt?new Date(`${form.startsAt}T00:00:00+05:00`).toISOString():null,active:form.active,expiresAt:form.expiresAt?new Date(`${form.expiresAt}T23:59:59+05:00`).toISOString():null});
      setPromo(prev=>({...prev,code:""}));await loadPromos();notify({tone:"success",title:"Promokod yaratildi"});
    }catch(e){notify({tone:"danger",title:"Promokod yaratilmagan",message:e?.message||"Xatolik"})}
    finally{promoActionRef.current=false;setPromoBusy(false)}
  };
  const deactivatePromo=async(id)=>{
    if(promoActionRef.current)return;
    promoActionRef.current=true;
    setPromoBusy(true);
    try{
      const yes=await confirm({title:"Promokodni to‘xtatish",message:"Bu kodni yangi foydalanishlar uchun o‘chirasizmi?",confirmLabel:"To‘xtatish"});
      if(!yes)return;
      await api.post(`/api/platform/promos/${encodeURIComponent(id)}/deactivate`,{});
      await loadPromos();
    }catch(e){notify({tone:"danger",title:"Amal bajarilmadi",message:e.message})}
    finally{promoActionRef.current=false;setPromoBusy(false)}
  };
  const resetPassword=async()=>{
    if(!detail?.id||!resetTarget||resetBusy||resetActionInFlightRef.current)return;
    if(resetForm.password.length<12||resetForm.reason.trim().length<10){notify({tone:"danger",title:"Parol 12 belgi, sabab 10 belgi bo'lishi kerak"});return}
    const request=resetRequestRef.current,organizationId=detail.id,userId=resetTarget.id,form={...resetForm};
    const lock={};
    resetActionInFlightRef.current=lock;
    setResetBusy(true);
    try{
      const allowed=await confirm({title:"Xodim parolini tiklash",message:"Mijoz shaxsi tekshirilganmi? Barcha sessiyalar bekor qilinadi.",confirmLabel:"Tiklash"});
      if(!allowed||request!==resetRequestRef.current)return;
      await api.post(`/api/platform/organizations/${organizationId}/users/${userId}/reset-password`,{...form,identityVerified:true});
      if(request!==resetRequestRef.current)return;
      closeReset();notify({tone:"success",title:"Parol tiklandi",message:"Keyingi kirishda yangi parol talab qilinadi."});
    }catch(e){if(request===resetRequestRef.current)notify({tone:"danger",title:"Xato",message:e.message})}
    finally{if(resetActionInFlightRef.current===lock)resetActionInFlightRef.current=null;if(request===resetRequestRef.current)setResetBusy(false)}
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
    setPageRows([]);setResultTotal(0);setPageLoading(true);setPageError("");
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
    const paymentId=payment?.id||payment?.orderId;
    if(!paymentId||reviewInFlightRef.current)return;
    reviewInFlightRef.current=paymentId;
    setReviewBusyId(paymentId);
    try{
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
        paymentId,
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
    }catch(error){
      notify({tone:"danger",title:"To‘lovni tekshirishda xato",message:error?.message||"Qayta urinib ko‘ring."});
    }finally{
      reviewInFlightRef.current=null;
      setReviewBusyId(null);
    }
  };

  const openReceipt=async payment=>{
    const requestId=++receiptRequestRef.current;
    setReceipt(payment);setReceiptUrl("");setReceiptLoading(true);setReceiptZoom(false);
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
  const openDetail=async(org,section="overview")=>{closeReset();
    const diagnostics=["storage","support","recovery"];
    setDetailSection(diagnostics.includes(section)?"diagnostics":section);
    setDetailDiagnosticTab(diagnostics.includes(section)?section:"business");
    setDetailError("");setDetailUserQuery("");setVisibleAuditCount(20);
    const requestId=++detailRequestRef.current;
    const organizationId=org.id;
    detailOrganizationRef.current=organizationId;
    setUsage(null);setUsageError("");setRecoveryPreview(null);setStoreQuota(null);setRecoveryBusy(false);
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
      }else {setDetailError(detailResult.reason?.message||"Tashkilot tafsilotlarini yuklab bo‘lmadi.");notify({tone:"danger",title:"Tashkilot tafsiloti yuklanmadi",message:detailResult.reason?.message||"Ma’lumotni olib bo‘lmadi."});}
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
  const closeDetail=()=>{closeReset();detailRequestRef.current+=1;detailOrganizationRef.current=null;setRecoveryBusy(false);setUsage(null);setDetailLoaded(false);setDetailPayments([]);setDetail(null);setDetailAuditLoading(false);setDetailAuditHasMore(false)};
  const controlBusiness=async(action)=>{
    if(!detail?.id||!detailLoaded||controlBusy||controlInFlightRef.current)return;
    const form={...licenseForm};
    if(form.reason.trim().length<8){notify({tone:"danger",title:"Sababni kiriting",message:"Kamida 8 ta belgidan iborat izoh yozing."});return}
    const organizationId=detail.id,organizationName=detail.name;
    // Acquire before confirmation, not after: multiple quick clicks must share one action.
    controlInFlightRef.current=true;
    setControlBusy(true);
    try{
      const accepted=await confirm({title:"Biznes sozlamalarini o‘zgartirish",message:`${organizationName} · ${action==="SUSPEND"?"Kirishni vaqtincha cheklash":action==="RESTORE"?"Faollikni tiklash":action==="PAYWALL"?"To‘lovgacha bloklash":action==="RELEASE_PAYWALL"?"To‘lov cheklovini yechish":action==="SEND_NOTICE"?"Mijozga ogohlantirish yuborish":"Tarif va filial limitini qo‘lda o‘zgartirish"}. Bu amal audit tarixiga yoziladi.`,confirmLabel:"Tasdiqlash",cancelLabel:"Bekor qilish",tone:"primary"});
      if(!accepted)return;
      const body={action,reason:form.reason.trim()};
      if(action==="SET_LICENSE")Object.assign(body,{plan:form.plan,expiryDate:form.expiryDate,storeLimit:Number(form.storeLimit)});
      const result=await api.post(`/api/platform/organizations/${encodeURIComponent(organizationId)}/control`,body);
      setDetail(previous=>previous?.id===organizationId?{...previous,...result.organization}:previous);
      setLicenseForm(previous=>({...previous,reason:""}));
      notify({tone:"success",title:"Biznes yangilandi",message:"O‘zgarish auditga yozildi."});
      await reloadStore();
    }catch(error){notify({tone:"danger",title:"Amal bajarilmadi",message:error?.message||"Biznesni yangilab bo‘lmadi."})}
    finally{controlInFlightRef.current=false;setControlBusy(false)}
  };

  return <div className="pro-page platform-pro">
    <PageHeader title="Platform boshqaruvi" subtitle="Mijozlar, to‘lov tekshiruvi, tarif va platforma nazorati." actions={<button className="pro-btn secondary" disabled={!workspaceReady} onClick={()=>reloadStore()}><FiRefreshCw/> Yangilash</button>}/>{persistenceError&&<div className="pro-alert danger"><strong>Platforma ma’lumotlari yuklanmadi.</strong><span>{persistenceError}</span><button className="pro-btn secondary" onClick={()=>reloadStore()}>Qayta urinish</button></div>}
    {tab==="dashboard"&&<div className="pro-stat-grid"><StatCard icon={FiUsers} label="Tashkilotlar" value={Number(platformOverview?.organizations||0)} hint="Jami mijozlar" tone="blue"/><StatCard icon={FiShield} label="Faol tariflar" value={active} hint="Faol tashkilotlar" tone="green"/><StatCard icon={FiCreditCard} label="Tekshiruvdagi to‘lovlar" value={review} hint="Tasdiq kutilmoqda" tone="orange"/><StatCard icon={FiFileText} label="Jami filiallar" value={stores} hint="Barcha tashkilotlar" tone="purple"/></div>}
    {tab==="dashboard"&&<><button type="button" className="pro-btn secondary platform-metrics-toggle" aria-expanded={moreMetrics} onClick={()=>setMoreMetrics(v=>!v)}>{moreMetrics?"Qo‘shimcha ko‘rsatkichlarni yashirish":"Yana 7 ta ko‘rsatkichni ko‘rish"}</button><PlatformSummary overview={platformOverview} showMetrics={moreMetrics}/></>}

    <section className="pro-card platform-directory">
      <div className="platform-tab-navigation">
        <div className="pro-tabs platform-admin-tabs" role="navigation" aria-label="Platforma boshqaruvi bo‘limlari">
          <button type="button" key="dashboard" className={tab==="dashboard"?"active":""} aria-current={tab==="dashboard"?"page":undefined} onClick={()=>changeTab("dashboard")}>Boshqaruv</button>
          <button type="button" key="customers" className={tab==="customers"?"active":""} aria-current={tab==="customers"?"page":undefined} onClick={()=>changeTab("customers")}>Mijozlar</button>
          <button type="button" key="payments" className={tab==="payments"?"active":""} aria-current={tab==="payments"?"page":undefined} onClick={()=>changeTab("payments")}>To‘lovlar</button>
          <button type="button" key="promos" className={tab==="promos"?"active":""} aria-current={tab==="promos"?"page":undefined} onClick={()=>changeTab("promos")}>Promokodlar</button>
          <button type="button" key="storage" className={tab==="storage"?"active":""} aria-current={tab==="storage"?"page":undefined} onClick={()=>changeTab("storage")}>Saqlash</button>
          <button type="button" key="support" className={tab==="support"?"active":""} aria-current={tab==="support"?"page":undefined} onClick={()=>changeTab("support")}>Yordam</button>
          <button type="button" key="recovery" className={tab==="recovery"?"active":""} aria-current={tab==="recovery"?"page":undefined} onClick={()=>changeTab("recovery")}>Tiklash</button>
          <button type="button" key="audit" className={tab==="audit"?"active":""} aria-current={tab==="audit"?"page":undefined} onClick={()=>changeTab("audit")}>Audit</button>
        </div>
        <span className="platform-tab-scroll-hint" aria-hidden="true">Boshqa bo‘limlar uchun yon tomonga suring</span>
      </div>
      <div className="platform-section-heading">
        <div><h2>{({dashboard:"Mijozlar holati",customers:"Mijozlar ro‘yxati",payments:"To‘lovlarni tekshirish",promos:"Promokodlarni boshqarish",storage:"Saqlash diagnostikasi",support:"Mijozlarni qo‘llab-quvvatlash",recovery:"Backup va tiklash nazorati",audit:"Platforma audit jurnali"})[tab]}</h2>
        <p>{({dashboard:"Bizneslar bo‘yicha umumiy ro‘yxat",customers:"Tashkilot, tarif va filiallarni boshqaring",payments:"Cheklarni tekshirish va to‘lov holatini tasdiqlash",promos:"Chegirma kodlari va foydalanish limitlari",storage:"Biznesni ochib fayllar va baza hajmini tekshiring",support:"Biznesni ochib xatolik va to‘lov diagnostikasini ko‘ring",recovery:"Biznesni ochib snapshot va tiklash tayyorgarligini ko‘ring",audit:"Tizimdagi amallar va o‘zgarishlar tarixi"})[tab]}</p></div>
      </div>
      {(tab==="storage"||tab==="support"||tab==="recovery")&&<div className="platform-section-notice" role="note">Quyidagi ro‘yxatdan biznesni <strong>Ko‘rish</strong> orqali tanlang. {tab==="storage"?"Saqlash statistikasi":tab==="support"?"Yordam diagnostikasi":"Backup va tiklash holati"} biznes tafsilotlari oynasida ochiladi.</div>}
      {tab!=="audit"&&<div className="platform-toolbar">
        <div className="pro-search"><FiSearch/><input aria-label={tab==="promos"?"Promokod qidirish":"Biznes qidirish"} value={query} onChange={event=>setQuery(event.target.value)} placeholder={tab==="promos"?"Promokod qidirish...":tab==="payments"?"To‘lov yoki tashkilot qidirish...":"Biznes qidirish..."}/></div>
        {tab!=="promos"&&<><label className="platform-filter-label" htmlFor="platform-status-filter">{tab==="payments"?"To‘lov holati":"Biznes holati"}</label>
        <PremiumSelect name="platform-status-filter" className="pro-select" value={status} onChange={event=>setStatus(event.target.value)} aria-label={tab==="payments"?"To‘lov holati":"Biznes holati"}><option value="all">Barcha holatlar</option>{tab==="payments"?<><option value="REVIEW">Tekshiruvda</option><option value="APPROVED">Tasdiqlangan</option><option value="REJECTED">Rad etilgan</option></>:<><option value="ACTIVE">Faol</option><option value="TRIAL">Sinovda</option><option value="BILLING_HOLD">Billing cheklovi</option><option value="PAYMENT_REQUIRED">To‘lov kutilmoqda</option><option value="REVIEW">Tekshiruvda</option><option value="REJECTED">Rad etilgan</option><option value="EXPIRED">Muddati tugagan</option><option value="SUSPENDED">Bloklangan</option></>}</PremiumSelect>
        <ColumnPicker columns={tab==="payments"?paymentColumnDefs:customerColumnDefs} visible={tab==="payments"?paymentColumns:customerColumns} onToggle={tab==="payments"?togglePaymentColumn:toggleCustomerColumn}/></>}
      </div>}
      {!["promos","audit"].includes(tab)&&<div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead>{tab==="payments"?<tr><th>To‘lov</th><th>Tashkilot</th>{showPaymentColumn("purpose")&&<th>Maqsad</th>}{showPaymentColumn("amount")&&<th>Summa</th>}{showPaymentColumn("receipt")&&<th>Chek</th>}{showPaymentColumn("status")&&<th>Holat</th>}<th>Amal</th></tr>:<tr><th>Tashkilot</th>{showCustomerColumn("owner")&&<th>Egasi</th>}{showCustomerColumn("stores")&&<th>Filiallar</th>}{showCustomerColumn("plan")&&<th>Tarif</th>}{showCustomerColumn("expiry")&&<th>Muddati</th>}<th>Amal</th></tr>}</thead><tbody>{tab==="payments"?pageLoading||pageError?null:resultTotal?pagedRows.map(payment=><tr key={payment.id||payment.orderId}>
        <td data-label="To‘lov"><strong>{paymentDisplayLabel(payment)}</strong><small>{payment.submittedAt?new Date(payment.submittedAt).toLocaleString("uz-UZ"):"—"}</small></td>
        <td data-label="Tashkilot">{payment.organization}</td>
        {showPaymentColumn("purpose")&&<td data-label="Maqsad">{payment.purpose}{payment.servicePeriodFrom&&payment.servicePeriodTo?<small>{new Date(payment.servicePeriodFrom).toLocaleDateString("uz-UZ")} → {new Date(payment.servicePeriodTo).toLocaleDateString("uz-UZ")}</small>:payment.intent==="RENEW"?<small>Uzaytirish</small>:null}</td>}
        {showPaymentColumn("amount")&&<td data-label="Summa"><strong>{formatPrice(payment.amount,"UZS")}</strong></td>}
        {showPaymentColumn("receipt")&&<td data-label="Chek"><button className="pro-btn secondary" disabled={!payment.receiptId} title={payment.receiptId?"Chekni ochish":"Chek biriktirilmagan"} onClick={()=>openReceipt(payment)}><FiEye/> {payment.receiptId?"Ko‘rish":"Chek yo‘q"}</button></td>}
        {showPaymentColumn("status")&&<td data-label="Holat"><StatusBadge tone={tone(payment.status)}>{STATUS_LABELS[payment.status]||payment.status}</StatusBadge></td>}
        <td data-label="Amal">{payment.status==="REVIEW"?<div className="pro-row-actions"><button className="pro-btn success platform-row-action" title="Tasdiqlash" aria-label="To‘lovni tasdiqlash" disabled={!!reviewBusyId} onClick={()=>update(payment,"APPROVED")}><FiCheck/> {reviewBusyId===(payment.id||payment.orderId)?"Tekshirilmoqda...":"Tasdiqlash"}</button><button className="pro-btn danger platform-row-action" title="Rad etish" aria-label="To‘lovni rad etish" disabled={!!reviewBusyId} onClick={()=>setReject(payment)}><FiX/> Rad etish</button></div>:"—"}</td>
      </tr>):<tr><td colSpan={3+paymentColumns.length}><div className="pro-empty"><FiCreditCard/><strong>To‘lov topilmadi</strong></div></td></tr>:pagedRows.map(org=><tr key={org.id}>
        <td data-label="Tashkilot"><strong>{org.name}</strong><small>{org.phone||"Telefon kiritilmagan"}</small></td>
        {showCustomerColumn("owner")&&<td data-label="Egasi"><strong>{org.owner}</strong><small>{org.phone}</small></td>}
        {showCustomerColumn("stores")&&<td data-label="Filiallar">{org.stores}</td>}
        {showCustomerColumn("plan")&&<td data-label="Tarif"><strong>{planLabel(org.plan)}</strong><StatusBadge tone={tone(org.licenseStatus)}>{STATUS_LABELS[org.licenseStatus]||org.licenseStatus}</StatusBadge>{org.billingHold&&<StatusBadge tone="warning">Billing cheklovi</StatusBadge>}{org.trialEndsAt&&Date.parse(org.trialEndsAt)>Date.now()&&<StatusBadge tone="neutral">Sinovda</StatusBadge>}</td>}
        {showCustomerColumn("expiry")&&<td data-label="Muddati">{org.expiryDate?new Date(org.expiryDate).toLocaleDateString("uz-UZ"):"—"}</td>}
        <td data-label="Amal"><button className="pro-btn secondary platform-row-action" onClick={()=>openDetail(org,tab==="storage"?"storage":tab==="support"?"support":tab==="recovery"?"recovery":"overview")} aria-label={tab==="storage"?"Saqlash hajmini ko‘rish":tab==="support"?"Yordam diagnostikasini ko‘rish":tab==="recovery"?"Tiklash holatini ko‘rish":"Tashkilotni ko‘rish"}><FiEye/> {tab==="storage"?"Saqlash":tab==="support"?"Yordam":tab==="recovery"?"Tiklash":"Ko‘rish"}</button></td>
      </tr>)}{tab!=="payments"&&!["promos","audit"].includes(tab)&&!pagedRows.length&&!pageLoading&&!pageError&&<tr><td colSpan={customerColumns.length+2}><div className="pro-empty"><FiUsers/><strong>Tashkilot topilmadi</strong></div></td></tr>}</tbody></table></div>}{!pageLoading&&!pageError&&!["promos","audit"].includes(tab)&&resultTotal>pageSize&&<div className="platform-pagination"><span>{resultTotal} ta natija · {page}/{totalPages} sahifa</span><div><button className="pro-btn secondary" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Oldingi</button><button className="pro-btn secondary" disabled={page>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>Keyingi</button></div></div>}
      {pageLoading&&<div className="pro-empty" role="status">Ro‘yxat yuklanmoqda...</div>}{pageError&&<div className="pro-alert danger">{pageError}</div>}
    </section>
    {tab==="audit"&&<PlatformAudit/>}
    {tab==="promos"&&<section className="pro-card" style={{padding:18,marginTop:16}}>
      <div className="platform-promo-form-heading"><div><h2>Promokodlar ro‘yxati</h2><p>Faol chegirma kodlari va ularning foydalanish limitlarini boshqaring.</p></div><button type="button" className="pro-btn secondary" aria-expanded={promoFormOpen} onClick={()=>setPromoFormOpen(v=>!v)}>{promoFormOpen?"Formani yopish":"Yangi promokod yaratish"}</button></div>{promoFormOpen&&<><h3>Yangi promokod</h3><p>20%, 50%, 75% yoki 100% chegirma. Limit tugasa avtomatik bloklanadi.</p>
      <div className="pro-form-grid">
        <label className="pro-field"><span>Kod</span><input value={promo.code} onChange={e=>setPromo(v=>({...v,code:e.target.value.toUpperCase()}))} placeholder="ZENIX-FREE5"/></label>
        <label className="pro-field"><span>Tarif</span><PremiumSelect value={promo.plan} onChange={e=>setPromo(v=>({...v,plan:e.target.value}))}><option value="BOTH">Oylik va yillik</option><option value="MONTHLY">Oylik</option><option value="ANNUAL">Yillik</option></PremiumSelect></label>
        <label className="pro-field"><span>Chegirma (%)</span><PremiumSelect value={promo.percent} onChange={e=>setPromo(v=>({...v,percent:Number(e.target.value)}))}>{[20,50,75,100].map(v=><option key={v} value={v}>{v}%</option>)}</PremiumSelect></label>
        <label className="pro-field"><span>Umumiy foydalanish limiti</span><input type="number" min="1" value={promo.maxUses} onChange={e=>setPromo(v=>({...v,maxUses:e.target.value}))}/></label>
        <label className="pro-field"><span>Bitta biznes limiti</span><input type="number" min="1" value={promo.perBusiness} onChange={e=>setPromo(v=>({...v,perBusiness:e.target.value}))}/></label>
        <label className="pro-field"><span>Boshlanish sanasi (ixtiyoriy)</span><PremiumDateInput value={promo.startsAt} onChange={e=>setPromo(v=>({...v,startsAt:e.target.value}))}/></label><label className="pro-field"><span>Holat</span><PremiumSelect value={String(promo.active)} onChange={e=>setPromo(v=>({...v,active:e.target.value==="true"}))}><option value="true">Faol</option><option value="false">Faolsiz</option></PremiumSelect></label><label className="pro-field"><span>Oxirgi amal qilish kuni (ixtiyoriy)</span><PremiumDateInput value={promo.expiresAt} onChange={e=>setPromo(v=>({...v,expiresAt:e.target.value}))}/></label>
      </div>
      {promo.code.length<4&&<p className="platform-support-caption" role="status">Kod kamida 4 belgidan iborat bo‘lishi kerak.</p>}<button className="pro-btn primary" disabled={promoBusy||promo.code.length<4} onClick={savePromo}>{promoBusy?"Saqlanmoqda...":"Promokod yaratish"}</button></>}
      <div className="pro-table-wrap mobile-card-wrap" style={{marginTop:18}}><table className="pro-table mobile-card-table"><thead><tr><th>Kod</th><th>Tarif</th><th>Chegirma</th><th>Foydalanilgan</th><th>Sanalar</th><th>Holat</th><th>Amal</th></tr></thead><tbody>
      {promos.map(item=><tr key={item.id}><td data-label="Kod"><strong>{item.code}</strong></td><td data-label="Tarif">{planLabel(item.plan)}</td><td data-label="Chegirma">{item.percent}%</td><td data-label="Foydalanish"><strong>{item.uses}/{item.maxUses}</strong><small>Band: {item.reserved||0} · Qolgan: {item.remaining} · Har biznes: {item.perBusiness}</small></td><td data-label="Sanalar">{item.startsAt?new Date(item.startsAt).toLocaleDateString("uz-UZ"):"Darhol"} → {item.expiresAt?new Date(item.expiresAt).toLocaleDateString("uz-UZ"):"Cheksiz"}</td><td data-label="Holat"><StatusBadge tone={item.active&&(!item.startsAt||Date.parse(item.startsAt)<=Date.now())&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now())&&item.remaining>0?"success":"neutral"}>{item.active&&(!item.startsAt||Date.parse(item.startsAt)<=Date.now())&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now())&&item.remaining>0?"Faol":"Yopilgan"}</StatusBadge></td><td data-label="Amal">{item.active&&<button type="button" className="pro-btn secondary" disabled={promoBusy} onClick={()=>deactivatePromo(item.id)}>O‘chirish</button>}</td></tr>)}
      </tbody></table></div>{promoLoading&&<div className="pro-empty">Yuklanmoqda...</div>}{promoError&&<div className="pro-alert danger" role="alert">{promoError}</div>}{!promoLoading&&!promoError&&!promos.length&&<div className="pro-empty">Promokod topilmadi</div>}{promoTotal>pageSize&&<div className="platform-pagination"><span>{promoTotal} ta · {page}/{totalPages}</span><button className="pro-btn secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Oldingi</button><button className="pro-btn secondary" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Keyingi</button></div>}
    </section>}

    <Modal open={!!receipt} onClose={closeReceipt} title="To‘lov cheki" subtitle={paymentDisplayLabel(receipt)} size="sm"><div className="admin-receipt-preview" style={{maxWidth:"100%",overflowX:"auto",gridTemplateColumns:"minmax(0,1fr)"}}>{receiptLoading?<div className="pro-empty"><FiFileText/><strong>Chek ochilmoqda...</strong></div>:receiptUrl&&receipt?.receiptType?.startsWith("image/")?<img src={receiptUrl} alt="To‘lov cheki" style={{maxWidth:receiptZoom?"none":"100%",width:receiptZoom?"200%":"auto",maxHeight:receiptZoom?"none":360,borderRadius:12,cursor:"zoom-in"}}/>:receiptUrl&&receipt?.receiptType==="application/pdf"?<iframe title="PDF chek" src={receiptUrl} style={{width:"100%",height:360,border:0,borderRadius:12}}/>:<FiFileText/>}<strong>{receipt?.receiptName||"To‘lov cheki"}</strong><span>{receipt?.organization}</span><b>{formatPrice(receipt?.amount||0,"UZS")}</b></div>{receiptUrl&&<div className="platform-receipt-actions">{receipt?.receiptType?.startsWith("image/")&&<button className="pro-btn secondary" type="button" aria-pressed={receiptZoom} onClick={()=>setReceiptZoom(v=>!v)}>{receiptZoom?"Kichraytirish":"2× kattalashtirish"}</button>}<a className="pro-btn secondary" target="_blank" rel="noopener noreferrer" href={receiptUrl}>Originalni ochish</a><a className="pro-btn secondary" href={receiptUrl} download={receipt?.receiptName||"zenix-chek"}>Yuklab olish</a></div>}{receipt?.rejectReason&&<div className="pro-alert danger">Rad etish sababi: {receipt.rejectReason}</div>}</Modal>
    <Modal open={!!reject} onClose={()=>setReject(null)} title="To‘lovni rad etish" subtitle="Sabab mijozning Tarif va to‘lovlar sahifasida ko‘rinadi." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setReject(null)}>Bekor qilish</button><button className="pro-btn danger" disabled={!reason.trim()||!!reviewBusyId} onClick={()=>update(reject,"REJECTED")}>{reviewBusyId?"Tekshirilmoqda...":"Rad etish"}</button></>}><label className="pro-field"><span>Sabab</span><textarea data-modal-autofocus value={reason} onChange={event=>setReason(event.target.value)} placeholder="Masalan: chekdagi summa mos kelmadi"/></label></Modal>
    <Modal open={!!detail} onClose={closeDetail} title={detail?.name||"Mijoz"} subtitle={`Biznes profili · ${detailTabs.find(([id])=>id===detailSection)?.[1]||"Umumiy"}`} size="lg" className="platform-customer-modal"><div className="platform-customer-detail">
      <div className="platform-customer-identity">
        <span>{detail?.owner||"Egasi ko‘rsatilmagan"}</span>
        {detail?.phone&&<span>{detail.phone}</span>}
        <StatusBadge tone={tone(detail?.licenseStatus)}>{STATUS_LABELS[detail?.licenseStatus]||detail?.licenseStatus||"Holat noma’lum"}</StatusBadge>
      </div>
      {detailError&&<div className="pro-alert danger" role="alert"><strong>Ma’lumotlar yuklanmadi</strong><span>{detailError}</span><button type="button" className="pro-btn secondary" onClick={()=>openDetail(detail,detailDiagnosticTab==="business"?detailSection:detailDiagnosticTab)}>Qayta urinish</button></div>}
      {!detailLoaded&&!detailError&&<div className="platform-detail-loading" role="status">Tashkilot ma’lumotlari yuklanmoqda...</div>}<nav className="platform-detail-jumps" role="tablist" aria-label="Mijoz tafsilotlari bo‘limlari">
      {detailTabs.map(([id,label],index)=><button key={id} type="button" role="tab" id={`platform-customer-tab-${id}`} aria-selected={detailSection===id} aria-controls="platform-customer-active-panel" tabIndex={detailSection===id?0:-1} className={detailSection===id?"active":""} onClick={()=>selectDetailTab(id)} onKeyDown={event=>onDetailTabKeyDown(event,index)}>{label}</button>)}
      </nav><div id="platform-customer-active-panel" role="tabpanel" aria-labelledby={`platform-customer-tab-${detailSection}`} className="platform-customer-panel">{detailSection==="overview"&&<><div className="platform-customer-kpis" id="platform-detail-overview"><div><span>Egasi</span><strong>{detail?.owner||"—"}</strong></div><div><span>Filiallar</span><strong>{detail?.stores||0} / {detail?.effectiveStoreLimit??detail?.storeLimit??0}</strong></div><div><span>Tarif holati</span><strong>{STATUS_LABELS[detail?.licenseStatus]||detail?.licenseStatus}</strong></div></div></>}{detailSection==="license"&&<section className="pro-card platform-detail-license"><h3 id="platform-detail-license" className="detail-subtitle"><FiShield/> Biznes va tarif boshqaruvi</h3><div className="platform-detail-grid"><label className="pro-field"><span>Tarif</span><PremiumSelect className="pro-select" disabled={!detailLoaded} value={licenseForm.plan} onChange={event=>setLicenseForm(prev=>({...prev,plan:event.target.value}))}><option value="MONTHLY">Oylik</option><option value="ANNUAL">Yillik</option></PremiumSelect></label><label className="pro-field"><span>Amal qilish sanasi</span><PremiumDateInput disabled={!detailLoaded} value={licenseForm.expiryDate} onChange={event=>setLicenseForm(prev=>({...prev,expiryDate:event.target.value}))}/></label><label className="pro-field"><span>Filial limiti</span><input type="number" min="1" max="500" disabled={!detailLoaded} value={licenseForm.storeLimit} onChange={event=>setLicenseForm(prev=>({...prev,storeLimit:event.target.value}))}/></label></div><label className="pro-field"><span>O‘zgartirish sababi (audit uchun)</span><textarea disabled={!detailLoaded} value={licenseForm.reason} onChange={event=>setLicenseForm(prev=>({...prev,reason:event.target.value}))} placeholder="Nima sababdan qo‘lda o‘zgartirilmoqda?"/></label><div className="platform-customer-license-actions"><button className="pro-btn primary" disabled={controlBusy||!detailLoaded||!licenseForm.expiryDate||!licenseForm.reason.trim()} onClick={()=>controlBusiness("SET_LICENSE")}>Tarifni saqlash</button></div><div className="platform-customer-danger-zone"><p><FiShield/> Maxsus boshqaruv amallari</p><small>Bloklash va to‘lov cheklovlari biznes faoliyatiga ta’sir qiladi. Amal oldidan tasdiqlash talab qilinadi.</small><div className="pro-row-actions">{detail?.licenseStatus==="SUSPENDED"?<button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("RESTORE")}>Blokdan chiqarish</button>:<button className="pro-btn danger" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("SUSPEND")}>Bloklash</button>}<div className="pro-row-actions" style={{flexWrap:"wrap",marginTop:10}}><button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("SEND_NOTICE")}>To‘lov eslatmasi yuborish</button>{detail?.billingHold?<button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("RELEASE_PAYWALL")}>To‘lov cheklovini yechish</button>:<button className="pro-btn secondary" disabled={controlBusy||!detailLoaded} onClick={()=>controlBusiness("PAYWALL")}>To‘lovgacha bloklash</button>}</div></div></div></section>}{detailSection==="diagnostics"&&<div className="platform-diagnostics-content"><div className="platform-diagnostics-tabs" role="tablist" aria-label="Diagnostika turi">{diagnosticsTabs.map(([key,label],index)=><button key={key} type="button" role="tab" id={`platform-diagnostic-tab-${key}`} aria-selected={detailDiagnosticTab===key} aria-controls="platform-diagnostic-active-panel" tabIndex={detailDiagnosticTab===key?0:-1} className={detailDiagnosticTab===key?"active":""} onKeyDown={event=>onDiagnosticsKeyDown(event,index)} onClick={()=>setDetailDiagnosticTab(key)}>{label}</button>)}</div><div id="platform-diagnostic-active-panel" role="tabpanel" aria-labelledby={`platform-diagnostic-tab-${detailDiagnosticTab}`}>{detailLoaded&&detailDiagnosticTab!=="recovery"&&<BusinessDiagnostics key={detail.id} view={detailDiagnosticTab} organization={detail} usage={usage} usageError={usageError}/>}{detailSection==="diagnostics"&&detailDiagnosticTab==="recovery"&&<section className="pro-card platform-recovery-card">
      <h3 id="platform-detail-recovery" className="detail-subtitle"><FiShield/> Tiklash va filial limitlari diagnostikasi</h3><p>Provider metadata va restore readiness quyida alohida tekshiriladi.</p>
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
    </section>}</div></div>}{detailSection==="users"&&<section className="platform-customer-users"><h3 id="platform-detail-users" className="detail-subtitle"><FiUserCheck/> Foydalanuvchilar</h3><label className="platform-customer-filter"><span>Xodim qidirish</span><input aria-label="Xodim ismi yoki logini" value={detailUserQuery} onChange={event=>setDetailUserQuery(event.target.value)} placeholder="Ism, login yoki telefon..."/></label><div className="platform-detail-list">{!detailLoaded?<div className="pro-empty" role="status">Xodimlar yuklanmoqda...</div> :(detail?.users||[]).filter(user=>[user.name,user.username,user.phone].some(value=>String(value||"").toLowerCase().includes(detailUserQuery.toLowerCase().trim()))).length?(detail.users||[]).filter(user=>[user.name,user.username,user.phone].some(value=>String(value||"").toLowerCase().includes(detailUserQuery.toLowerCase().trim()))).map(user=><div key={user.id}><span><strong>{user.name}</strong><small>{user.username} · {user.phone||"Telefon yo‘q"}</small></span><span><StatusBadge tone={user.active?"success":"neutral"}>{({OWNER:"Egasi",ADMIN:"Administrator",MANAGER:"Menejer",CASHIER:"Kassir",WAREHOUSE:"Omborchi",SALES:"Sotuvchi"})[user.role]||user.role}</StatusBadge><button className="pro-btn secondary" onClick={()=>openReset(user)}>Parolni tiklash</button></span></div>):<div className="pro-empty"><FiUsers/><strong>{detailUserQuery?"Qidiruvga mos xodim yo‘q":"Foydalanuvchi topilmadi"}</strong></div>}</div></section>}{detailSection==="stores"&&<section className="platform-customer-stores"><h3 id="platform-detail-stores" className="detail-subtitle"><FiMapPin/> Filiallar</h3><div className="platform-detail-list">{!detailLoaded?<div className="pro-empty" role="status">Filiallar yuklanmoqda...</div>:(detail?.storeRows||[]).length?(detail.storeRows||[]).map(store=><div key={store.id}><span><strong>{store.name}</strong><small>{store.createdAt?new Date(store.createdAt).toLocaleDateString("uz-UZ"):"—"}</small></span><StatusBadge tone={store.active?"success":"neutral"}>{store.active?"Faol":"Arxiv"}</StatusBadge></div>):<div className="pro-empty"><FiMapPin/><strong>Filial topilmadi</strong></div>}</div></section>}{detailSection==="stores"&&(detail?.extraStoreEntitlements||[]).length>0&&<><h3 className="detail-subtitle">Qo‘shimcha filial obunalari</h3><div className="platform-detail-list">{detail.extraStoreEntitlements.map(pass=><div key={pass.id}><span><strong>{pass.quantity} ta · {pass.duration==="MONTHLY"?"1 oy":pass.duration==="ANNUAL"?"1 yil":"Tarif tugaguncha"}</strong><small>{String(pass.startsOn||"").slice(0,10)} → {String(pass.expiresOn||"").slice(0,10)}</small></span><StatusBadge tone={pass.active?"success":"neutral"}>{pass.active?"Faol":"Tugagan"}</StatusBadge></div>)}</div></>}{detailSection==="payments"&&<><h3 id="platform-detail-payments" className="detail-subtitle">To‘lov tarixi</h3><div className="platform-detail-list">{!detailLoaded&&<div className="pro-empty" role="status">To‘lov tarixi yuklanmoqda...</div>}{detailLoaded&&detailPayments.map(item=><div key={item.id}><span><strong>{item.purpose}</strong><small>{item.submittedAt?new Date(item.submittedAt).toLocaleString("uz-UZ"):"—"}</small></span><span><b>{formatPrice(item.amount,"UZS")}</b><StatusBadge tone={tone(item.status)}>{STATUS_LABELS[item.status]||item.status}</StatusBadge></span></div>)}{detailLoaded&&!detailPayments.length&&<div className="pro-empty"><FiCreditCard/><strong>To‘lov tarixi yo‘q</strong></div>}</div></>}{detailSection==="audit"&&<><h3 id="platform-detail-audit" className="detail-subtitle">Audit</h3><div className="admin-timeline">{detailAuditLoading?<div><i/><span><strong>Audit yuklanmoqda...</strong></span></div>:detailAudit.length?detailAudit.slice(0,visibleAuditCount).map(log=><div key={log.id} className={/reject|suspend|hold|delete|failed|error/i.test(String(log.action||""))?"platform-audit-danger":/approved|restore|release|success/i.test(String(log.action||""))?"platform-audit-success":""}><i/><span><strong>{log.title||log.action}</strong><small>{[log.userName,log.storeName,log.description].filter(Boolean).join(" · ")} · {log.createdAt?new Date(log.createdAt).toLocaleString("uz-UZ"):"—"}</small></span></div>):<div><i/><span><strong>Audit yozuvi topilmadi</strong><small>Bu tashkilot uchun server audit logi hali yo‘q.</small></span></div>}</div>{visibleAuditCount<detailAudit.length&&<button className="pro-btn secondary" onClick={()=>setVisibleAuditCount(n=>n+20)}>Yana 20 ta yozuvni ko‘rish</button>}{detailAuditHasMore&&visibleAuditCount>=detailAudit.length&&<button className="pro-btn secondary" disabled={detailAuditLoading} onClick={loadMoreAudit}>Keyingi audit yozuvlarini yuklash</button>}</>}
      </div></div></Modal>
    <Modal open={!!resetTarget} onClose={closeReset} title="Xodim parolini tiklash" subtitle="Faqat shaxs tasdiqlangandan so‘ng. Amal audit tarixiga yoziladi." size="sm" footer={resetMode==="password"?<><button className="pro-btn secondary" onClick={closeReset}>Bekor qilish</button><button className="pro-btn primary" disabled={resetBusy||resetForm.password.length<12||resetForm.reason.trim().length<10} onClick={resetPassword}>Vaqtinchalik parolni saqlash</button></>:null}>
      <div className="platform-reset-options pro-segmented" role="group" aria-label="Parolni tiklash usuli">
        <button type="button" className={resetMode==="token"?"active":""} aria-pressed={resetMode==="token"} disabled={resetBusy||!!resetToken} onClick={()=>setResetMode("token")}>Bir martalik token</button>
        <button type="button" className={resetMode==="password"?"active":""} aria-pressed={resetMode==="password"} disabled={resetBusy||!!resetToken} onClick={()=>setResetMode("password")}>Administrator parol beradi</button>
      </div>
      <p className="platform-reset-hint">{resetMode==="token"?"Xodim 15 daqiqa ichida /reset-password sahifasida token yordamida yangi parol o‘rnatadi.":"Administrator vaqtinchalik parol beradi. Xodim keyingi kirishda parolni o‘zgartirishi talab qilinadi."}</p>
      <label className="pro-field"><span>Shaxsni tekshirish sababi (kamida 10 belgi)</span><input value={resetForm.reason} onChange={e=>setResetForm(v=>({...v,reason:e.target.value}))} placeholder="Shaxsni qanday tasdiqladingiz?"/></label>
      {resetMode==="token"?
        <div className="platform-reset-flow">
          {resetToken&&<div className="pro-alert" role="status"><strong>Bir martalik token (15 daqiqa)</strong><input readOnly value={resetToken.token} aria-label="Tiklash tokeni"/><button type="button" className="pro-btn secondary" onClick={()=>navigator.clipboard.writeText(resetToken.token).then(()=>notify({tone:"success",title:"Token nusxalandi"})).catch(()=>notify({tone:"danger",title:"Tokenni nusxalab bo‘lmadi"}))}>Tokenni nusxalash</button><small>Mijoz /reset-password sahifasida tokenni kiritadi. {new Date(resetToken.expiresAt).toLocaleString("uz-UZ")} gacha.</small></div>}
          <button type="button" className="pro-btn primary" disabled={resetBusy||!!resetToken||resetForm.reason.trim().length<10} onClick={issueResetToken}>{resetBusy?"Yaratilmoqda...":resetToken?"Token yaratildi":"Token yaratish"}</button>
        </div>:
        <label className="pro-field"><span>Vaqtinchalik parol (kamida 12 belgi)</span><input type="password" autoComplete="new-password" value={resetForm.password} onChange={e=>setResetForm(v=>({...v,password:e.target.value}))}/></label>}
    </Modal>
  </div>;
}
export default PlatformAdmin;
