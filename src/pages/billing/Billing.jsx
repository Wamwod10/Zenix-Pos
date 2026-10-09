import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft, FiCheck, FiClock, FiCopy, FiCreditCard, FiEye, FiFileText,
  FiGift, FiMapPin, FiPlus, FiShield, FiCheckCircle,FiLock,
} from "react-icons/fi";
import { BILLING_CONFIG, BILLING_PLANS, addBillingDays, addBillingMonths, billingDateISO, billingDaysBetween } from "../../config/billing";
import { paymentService } from "../../services/paymentService";
import { api } from "../../services/apiClient";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { formatPrice } from "../../utils/formatPrice";
import { FilePicker, PageHeader, StatusBadge, PremiumDateInput, PremiumSelect, ColumnPicker } from "../../components/Ui";
import Modal from "../../components/Modal";
import { useFeedback } from "../../context/FeedbackContext";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { billingPaymentReviewState, hasPendingBillingPayment, startBillingPaymentPolling } from "./billingPolling";
import { coveredExtraStoresForPeriod } from "./extraStoreCoverage";

const STATUS_LABELS={ACTIVE:"Faol",APPROVED:"Faol",REVIEW:"Tekshiruvda",REJECTED:"Rad etildi",EXPIRED:"Muddati tugagan",SUSPENDED:"Administrator tomonidan bloklangan",PAYMENT_REQUIRED:"To‘lov kutilmoqda",PENDING:"Kutilmoqda"};
const statusTone=status=>["ACTIVE","APPROVED"].includes(status)?"success":status==="REJECTED"||status==="EXPIRED"||status==="SUSPENDED"?"danger":status==="REVIEW"?"warning":"neutral";
const fmtDate=value=>value?new Date(value).toLocaleDateString("uz-UZ"):"—";
const billingPrice=value=>formatPrice(value,"UZS");
const localDateISO=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const daysUntil=value=>value?Math.max(0,billingDaysBetween(localDateISO(),String(value).slice(0,10))):0;

const billingPaymentLabel=item=>item?.orderId||["To‘lov",item?.submittedAt?fmtDate(item.submittedAt):""].filter(Boolean).join(" · ");
function Billing({activation=false}){
  const {currentUser,logout}=useAuth();
  const navigate=useNavigate();
  const {notify}=useFeedback();
  const {stores,payments,organizations,hasPermission,billingDraft,loadBillingDraft,createBillingDraft,cancelBillingDraft,getBillingReceipt,commitBillingSubmission,reloadStore}=useStore();
  const currentOrg=organizations.find(org=>org.id===currentUser?.organizationId);
  const history=useMemo(()=>payments.filter(payment=>!currentUser?.organizationId||payment.organizationId===currentUser.organizationId).sort((a,b)=>new Date(b.submittedAt||0)-new Date(a.submittedAt||0)),[payments,currentUser?.organizationId]);
  const latestLicensePayment=history.find(payment=>payment.type!=="EXTRA");
  const paymentReviewState=billingPaymentReviewState(payments,currentUser?.organizationId);
  const pendingLicense=history.find(payment=>payment.type!=="EXTRA"&&payment.status==="REVIEW");
  const pendingExtra=history.find(payment=>payment.type==="EXTRA"&&payment.status==="REVIEW");
  const hasPendingPayment=hasPendingBillingPayment(payments,currentUser?.organizationId);
  const expiry=currentOrg?.expiryDate||null;
  const storedStatus=String(currentOrg?.licenseStatus||latestLicensePayment?.status||(activation?"PAYMENT_REQUIRED":"ACTIVE")).toUpperCase();
  const status=(["ACTIVE","APPROVED"].includes(storedStatus)&&expiry&&String(expiry).slice(0,10)<localDateISO())?"EXPIRED":storedStatus;
  const canWrite=activation||hasPermission("billingWrite",currentUser?.appRole);
  const readonly=!canWrite;
  const currentPlan=currentOrg?.plan&&BILLING_PLANS[currentOrg.plan]?currentOrg.plan:(latestLicensePayment?.plan&&BILLING_PLANS[latestLicensePayment.plan]?latestLicensePayment.plan:"ANNUAL");
  const included=(BILLING_PLANS[currentPlan]||BILLING_PLANS.ANNUAL).includedStores;
  const used=stores.filter(store=>store.active!==false).length;
  const storeLimit=Math.max(included,Number(currentOrg?.storeLimit||included));
  const purchasedExtras=Math.max(0,Number(currentOrg?.purchasedExtraStores??(Number(currentOrg?.baseStoreLimit??storeLimit)-included)));
  const currentPlanDays=Number((BILLING_PLANS[currentPlan]||BILLING_PLANS.ANNUAL).referenceDays||365);
  // Extra-store pricing must cover the whole real remaining service period.
  // Do not clamp to one plan cycle because an owner can renew multiple years ahead.
  const remainingDays=expiry?Math.max(1,daysUntil(expiry)):currentPlanDays;
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  const [flow,setFlow]=useState(()=>paymentReviewState==="waiting"?"waiting":activation||["PAYMENT_REQUIRED","REJECTED"].includes(status)?"plans":status==="EXPIRED"?"renew":"overview");
  const [plan,setPlan]=useState(currentPlan);
  const [licenseIntent,setLicenseIntent]=useState(()=>activation||!["ACTIVE","APPROVED","EXPIRED"].includes(status)?"ACTIVATE":"RENEW");
  const renewalBaseDate=billingDateISO(expiry&&String(expiry).slice(0,10)>=localDateISO()?expiry:new Date());
  const defaultRenewTargetDate=addBillingMonths(renewalBaseDate,currentPlan==="MONTHLY"?1:12);
  const [renewTargetDate,setRenewTargetDate]=useState(()=>defaultRenewTargetDate);
  const fullTermCoveredExtras=coveredExtraStoresForPeriod(currentOrg?.extraStoreEntitlements,renewalBaseDate,renewTargetDate);
  const minimumRenewExtraStores=Math.max(0,used-included-fullTermCoveredExtras);
  const defaultRenewExtraStores=Math.max(purchasedExtras,minimumRenewExtraStores);
  const [renewExtraStores,setRenewExtraStores]=useState(defaultRenewExtraStores);
  const [paymentType,setPaymentType]=useState("LICENSE");
  const [extraStores,setExtraStores]=useState(1);
  const [extraDuration,setExtraDuration]=useState("UNTIL_LICENSE");
  const [promoCode,setPromoCode]=useState("");
  const [promoPreview,setPromoPreview]=useState(null);
  const [promoBusy,setPromoBusy]=useState(false);
  const [checkoutDraft,setCheckoutDraft]=useState(null);
  const [file,setFile]=useState(null);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [preparing,setPreparing]=useState(false);
  const [receiptView,setReceiptView]=useState(null);
  const [receiptUrl,setReceiptUrl]=useState("");
  const [receiptLoading,setReceiptLoading]=useState(false);
  const handledPaymentIdRef=useRef("");
  const billingColumnDefs=[{id:"purpose",label:"Maqsad"},{id:"period",label:"Davr"},{id:"amount",label:"Summa"},{id:"status",label:"Holat"},{id:"receipt",label:"Chek"}];
  const {visible:billingColumns,toggle:toggleBillingColumn,show:showBillingColumn}=usePersistentColumns("zenix_billing_history_columns",billingColumnDefs);
  const preview=useMemo(()=>file&&file.type.startsWith("image/")?URL.createObjectURL(file):null,[file]);
  const billingFlowDirty=(flow==="renew"&&(renewTargetDate!==defaultRenewTargetDate||renewExtraStores!==defaultRenewExtraStores))||(flow==="plans"&&plan!==currentPlan)||(flow==="payment"&&Boolean(file));
  const guardBillingExit=useUnsavedGuard(billingFlowDirty,"Tarif yoki to‘lov bo‘yicha kiritilgan o‘zgarishlar saqlanmagan. Chiqsangiz, ular yo‘qoladi.");

  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
  useEffect(()=>{setPlan(currentPlan)},[currentPlan]);
  useEffect(()=>{
    if(flow!=="renew")setRenewTargetDate(defaultRenewTargetDate);
  },[defaultRenewTargetDate,flow]);
  useEffect(()=>()=>{if(receiptUrl)URL.revokeObjectURL(receiptUrl)},[receiptUrl]);
  useEffect(()=>{
    if(!hasPendingPayment)return undefined;
    return startBillingPaymentPolling(reloadStore,{intervalMs:flow==="waiting"?2000:8000});
  },[flow,hasPendingPayment,reloadStore]);
  useEffect(()=>{
    if(flow!=="waiting")return;
    const paymentId=String(latestLicensePayment?.id||latestLicensePayment?.orderId||"");
    const authoritativeLicense=String(currentOrg?.licenseStatus||"").toUpperCase();
    if(paymentReviewState==="approved"&&["ACTIVE","APPROVED"].includes(authoritativeLicense)&&handledPaymentIdRef.current!==paymentId){
      handledPaymentIdRef.current=paymentId;
      notify({tone:"success",title:"To‘lov tasdiqlandi",message:"Platforma ochildi."});
      navigate("/",{replace:true});
      return;
    }
    if(paymentReviewState==="rejected"&&handledPaymentIdRef.current!==paymentId){
      handledPaymentIdRef.current=paymentId;
      setFlow("plans");
      setError(latestLicensePayment?.rejectReason||"To‘lov rad etildi. Chekni tekshirib qayta yuboring.");
    }
  },[flow,paymentReviewState,navigate,notify,latestLicensePayment?.id,latestLicensePayment?.orderId,latestLicensePayment?.rejectReason,currentOrg?.licenseStatus]);
  useEffect(()=>{
    if(!canWrite)return;
    let active=true;
    void loadBillingDraft().then((result)=>{
      const draft=result?.draft;if(!active||!draft||hasPendingPayment)return;
      setCheckoutDraft(draft);setPaymentType(draft.type||"LICENSE");setPlan(draft.plan||currentPlan);setLicenseIntent(draft.intent||draft.metadata?.intent||"RENEW");
      if(draft.type==="EXTRA"){
        setExtraStores(Math.max(1,Number(draft.extraStoreCount||1)));
        setExtraDuration(draft.metadata?.extraDuration||"UNTIL_LICENSE");
      }
      if(draft.type==="LICENSE"&&(draft.intent||draft.metadata?.intent)==="RENEW"){setRenewTargetDate(draft.selectedEndDate||defaultRenewTargetDate);setRenewExtraStores(Math.max(0,Number(draft.extraStoreCount||0)));}
      setFlow("payment");
    });
    return()=>{active=false};
  // load one open checkout only when the billing screen is entered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const renewalDays=billingDaysBetween(renewalBaseDate,renewTargetDate);
  const renewalDateValid=Boolean(renewTargetDate)&&renewalDays>0;
  const renewalNextStoreLimit=included+renewExtraStores;
  const renewalOrder=useMemo(()=>paymentService.buildRenewalOrder({plan:currentPlan,currentExpiry:renewalBaseDate,targetExpiry:renewTargetDate,renewalExtraStores:renewExtraStores}),[currentPlan,renewalBaseDate,renewTargetDate,renewExtraStores]);
  const planBaseDate=billingDateISO(expiry&&new Date(expiry).getTime()>Date.now()?expiry:new Date());
  const planTargetDate=addBillingMonths(planBaseDate,Number(BILLING_PLANS[plan]?.months||12));
  const extraBaseDate=billingDateISO(new Date());
  const extraTargetDate=expiry?billingDateISO(expiry):null;
  const order=useMemo(()=>paymentType==="LICENSE"&&licenseIntent==="RENEW"
    ? renewalOrder
    : paymentService.buildOrder({
        type:paymentType,intent:paymentType==="EXTRA"?"EXTRA":licenseIntent,plan,remainingDays,extraStores,
        renewalExtraStores:paymentType==="LICENSE"?purchasedExtras:0,
        currentExpiry:paymentType==="EXTRA"?extraBaseDate:planBaseDate,
        targetExpiry:paymentType==="EXTRA"?extraTargetDate:planTargetDate,
      }),[paymentType,licenseIntent,plan,remainingDays,extraStores,purchasedExtras,renewalOrder,extraBaseDate,extraTargetDate,planBaseDate,planTargetDate]);
  const checkoutOrder=checkoutDraft?.order||order;
  const annualMonthlyEquivalent=Math.round(BILLING_CONFIG.annual.amount/12);
  const renewalExtraAmount=plan==="MONTHLY"?BILLING_CONFIG.extraStore.monthlyAmount*purchasedExtras:BILLING_CONFIG.extraStore.annualAmount*purchasedExtras;

  const verifyPromo=async()=>{setPromoBusy(true);setError("");try{const data=await api.post("/api/billing/promo/preview",{code:promoCode.trim(),plan});setPromoPreview(data.promo||null)}catch(e){setPromoPreview(null);setError(e?.message||"Promokod yaroqsiz") }finally{setPromoBusy(false)}};
  const redeemFree=async()=>{setPromoBusy(true);setError("");try{await api.post("/api/billing/promo/redeem-free",{code:promoCode.trim(),plan});await reloadStore();setPromoCode("");setPromoPreview(null);setFlow("overview");notify({tone:"success",title:"Bepul tarif faollashdi"});if(activation)navigate("/",{replace:true})}catch(e){setError(e?.message||"Promokodni ishlatib bo‘lmadi")}finally{setPromoBusy(false)}};
  const copy=async(key,value)=>{try{await navigator.clipboard.writeText(String(value));setCopied(key);setTimeout(()=>setCopied(""),1400)}catch{setCopied("")}};
  const choose=fileValue=>{setError("");if(!fileValue)return;if(!BILLING_CONFIG.receipt.accepted.includes(fileValue.type)){setError("Faqat JPG, PNG yoki PDF qabul qilinadi");return}if(fileValue.size>BILLING_CONFIG.receipt.maxBytes){setError("Fayl hajmi 5MB dan oshmasligi kerak");return}setFile(fileValue)};
  const discardDraft=async()=>{const id=checkoutDraft?.id||billingDraft?.id;if(id)await cancelBillingDraft(id);setCheckoutDraft(null)};
  const startRenew=()=>{
    if(!canWrite)return;
    void discardDraft();setPaymentType("LICENSE");setLicenseIntent("RENEW");setPlan(currentPlan);setRenewExtraStores(defaultRenewExtraStores);
    setRenewTargetDate(defaultRenewTargetDate);setError("");setFile(null);setFlow("renew");
  };
  const startPlan=()=>{if(!canWrite)return;void discardDraft();setPaymentType("LICENSE");setLicenseIntent(["ACTIVE","APPROVED","EXPIRED"].includes(status)?"CHANGE_PLAN":"ACTIVATE");setPlan(currentPlan);setError("");setFile(null);setFlow("plans")};
  const startExtra=async()=>{
    if(!canWrite||!["ACTIVE","APPROVED"].includes(status)||hasPendingPayment)return;
    setPreparing(true);setError("");setFile(null);setPaymentType("EXTRA");setLicenseIntent("EXTRA");setPlan(currentPlan);setExtraStores(1);setExtraDuration("UNTIL_LICENSE");
    const result=await createBillingDraft({type:"EXTRA",plan:currentPlan,intent:"EXTRA",extraStoreCount:1,extraDuration:"UNTIL_LICENSE",metadata:{source:"extra"}});
    setPreparing(false);if(!result?.success){setError(result?.message||"To‘lov ma’lumotlarini tayyorlab bo‘lmadi.");return}
    setCheckoutDraft(result.draft);setFlow("payment");
  };
  const proceedRenew=async()=>{
    if(!canWrite||hasPendingPayment){setError("Boshqa to‘lov hali tekshiruvda. Avval uni yakunlang.");return}
    if(!renewalDateValid){setError("Uzaytirish sanasi joriy davr tugashidan keyin bo‘lishi kerak.");return}
    setPreparing(true);setError("");setPaymentType("LICENSE");setLicenseIntent("RENEW");
    const result=await createBillingDraft({type:"LICENSE",plan:currentPlan,intent:"RENEW",selectedEndDate:renewTargetDate,extraStoreCount:renewExtraStores,promoCode:promoPreview?.percent<100?promoCode.trim():"",metadata:{source:"renewal",purpose:renewalOrder.purpose,currentStoreLimit:storeLimit,nextStoreLimit:renewalNextStoreLimit,usedStores:used,includedStores:included}});
    setPreparing(false);if(!result?.success){setError(result?.message||"To‘lov ma’lumotlarini tayyorlab bo‘lmadi.");return}
    setCheckoutDraft(result.draft);setFlow("payment");
  };
  const proceedPlan=async()=>{
    if(!canWrite||hasPendingPayment){setError("Boshqa to‘lov hali tekshiruvda. Avval uni yakunlang.");return}
    setPreparing(true);setError("");setPaymentType("LICENSE");
    const result=await createBillingDraft({type:"LICENSE",plan,intent:licenseIntent,extraStoreCount:purchasedExtras,promoCode:promoPreview?.percent<100?promoCode.trim():"",metadata:{source:"plan",purpose:order.purpose,currentStoreLimit:storeLimit,usedStores:used,includedStores:included}});
    setPreparing(false);if(!result?.success){setError(result?.message||"To‘lov ma’lumotlarini tayyorlab bo‘lmadi.");return}
    setCheckoutDraft(result.draft);setFlow("payment");
  };
  const changeExtraStoreCount=async(nextValue,nextDuration=extraDuration)=>{
    if(!canWrite||preparing)return;
    const next=Math.max(1,Math.min(20,Number(nextValue||1)));
    if(next===extraStores&&nextDuration===extraDuration&&checkoutDraft?.id)return;
    const previous=extraStores;
    const previousDuration=extraDuration;
    setExtraStores(next);setExtraDuration(nextDuration);setPreparing(true);setError("");
    const result=await createBillingDraft({type:"EXTRA",plan:currentPlan,intent:"EXTRA",extraStoreCount:next,extraDuration:nextDuration,metadata:{source:"extra"}});
    setPreparing(false);
    if(!result?.success){setExtraStores(previous);setExtraDuration(previousDuration);setError(result?.message||"Filial limiti summasini yangilab bo‘lmadi.");return}
    setCheckoutDraft(result.draft);
  };
  const leaveToOverview=()=>guardBillingExit(()=>{void discardDraft();setFile(null);setError("");setPlan(currentPlan);setRenewTargetDate(defaultRenewTargetDate);setRenewExtraStores(defaultRenewExtraStores);setFlow("overview")});
  const back=()=>guardBillingExit(()=>{setFile(null);setError("");if(paymentType==="LICENSE"&&flow==="payment")setFlow(licenseIntent==="RENEW"?"renew":"plans");else {void discardDraft();setFlow("overview")}});


  const submit=async()=>{
    if(submitting||!canWrite)return;
    const duplicate=history.find(payment=>payment.status==="REVIEW");
    if(duplicate){setError("Boshqa to‘lov tekshiruvda. Avval uni yakunlang.");return}
    if(!file){setError("To‘lov chekini yuklang");return}
    setSubmitting(true);setError("");
    try{
      const draft=checkoutDraft;
      if(!draft?.id){setError("To‘lov drafti topilmadi. Qayta urinib ko‘ring.");return}
      const result=await commitBillingSubmission({draftId:draft.id,file});
      if(!result?.success){setError(result?.message||"To‘lovni yuborib bo‘lmadi.");return}
      const isExtra=paymentType==="EXTRA";
      setFile(null);setCheckoutDraft(null);setFlow(isExtra?"overview":"waiting");
      notify({tone:"success",title:"To‘lov yuborildi",message:isExtra?"Filial limiti to‘lovi tekshiruvga yuborildi.":"Chek qabul qilindi. Tasdiqlanishi kutilmoqda."});
    }finally{setSubmitting(false)}
  };


  const openReceipt=async payment=>{
    setReceiptView(payment);setReceiptLoading(true);
    if(receiptUrl){URL.revokeObjectURL(receiptUrl);setReceiptUrl("")}
    const result=await getBillingReceipt(payment.receiptId);
    if(result?.success&&result.blob)setReceiptUrl(URL.createObjectURL(result.blob));
    else if(!result?.success)setError(result?.message||"Chekni ochib bo‘lmadi.");
    setReceiptLoading(false);
  };
  const closeReceipt=()=>{if(receiptUrl&&!receiptUrl.startsWith("data:"))URL.revokeObjectURL(receiptUrl);setReceiptUrl("");setReceiptView(null)};

  const statusLabel=STATUS_LABELS[status]||status;
  const currentPlanLabel=BILLING_PLANS[currentPlan]?.label||"Yillik";
  const nextAmount=(BILLING_PLANS[currentPlan]?.amount||0)+(currentPlan==="MONTHLY"?BILLING_CONFIG.extraStore.monthlyAmount*purchasedExtras:BILLING_CONFIG.extraStore.annualAmount*purchasedExtras);

  const overview=!activation&&flow==="overview"&&<>
    <section className="pro-card billing-current-card">
      <div className="billing-current-main"><div className="billing-plan-mark"><FiShield/></div><div><div className="billing-current-title"><h2>{currentPlanLabel} tarif</h2><StatusBadge tone={statusTone(status)}>{statusLabel}</StatusBadge></div><p>{expiry?`${fmtDate(expiry)} gacha amal qiladi`:"Tarif muddati belgilanmagan"}</p></div></div>
      <div className="billing-current-metrics"><div><span>Qolgan muddat</span><strong>{expiry?`${daysUntil(expiry)} kun`:"—"}</strong></div><div><span>Filiallar</span><strong>{used} / {storeLimit}</strong></div><div><span>Keyingi davr</span><strong>{billingPrice(nextAmount)}</strong></div></div>
      <div className="billing-current-actions">{canWrite&&<button className="pro-btn primary" disabled={!!hasPendingPayment} onClick={startRenew}>{hasPendingPayment?"To‘lov tekshiruvda":"Tarifni uzaytirish"}</button>} {canWrite&&<button className="pro-btn secondary" disabled={!!hasPendingPayment} onClick={startPlan}>Tarifni o‘zgartirish</button>}</div>
    </section>
    <div className="billing-secondary-grid">
      <section className="pro-card billing-branch-card"><div className="billing-mini-icon"><FiMapPin/></div><div><span>Filial limiti</span><strong>{used} ta ishlatilmoqda · {storeLimit} ta limit</strong><small>{included} ta tarifda{purchasedExtras?` · ${purchasedExtras} ta qo‘shimcha`:""}</small></div>{canWrite&&<button className="pro-btn secondary" onClick={startExtra} disabled={!!hasPendingPayment||!["ACTIVE","APPROVED"].includes(status)||preparing}>{hasPendingPayment?"Tekshiruvda":"+ Filial limiti"}</button>}</section>
      <section className="pro-card billing-next-card"><div className="billing-mini-icon"><FiCreditCard/></div><div><span>Keyingi to‘lov</span><strong>{expiry?fmtDate(expiry):"Aktivatsiyadan so‘ng"}</strong><small>{billingPrice(nextAmount)} · {currentPlanLabel.toLowerCase()}</small></div></section>
    </div>
  </>;

  const renew=flow==="renew"&&<section className="pro-card billing-flow-card billing-renew-card">
    <div className="billing-flow-head"><button className="billing-back" onClick={leaveToOverview}><FiArrowLeft/></button><div><h2>Tarifni uzaytirish</h2><p>Joriy tarifni qaysi sanagacha davom ettirishni tanlang. Summa avtomatik hisoblanadi.</p></div></div>
    {hasPendingPayment&&<div className="pro-alert warning">To‘lov tekshiruvda. Avval uning natijasini kuting.</div>}
    <div className="billing-renew-layout">
      <div className="billing-renew-controls">
        <div className="billing-period-current"><span>Joriy davr tugashi</span><strong>{fmtDate(renewalBaseDate)}</strong><small>{status==="EXPIRED"?"Tarif muddati o‘tgan — yangi davr bugundan boshlanadi.":"Yangi davr shu sanadan keyin davom etadi."}</small></div>
        <label className="pro-field"><span>Qachongacha uzaytirish *</span><PremiumDateInput min={addBillingDays(renewalBaseDate,1)} value={renewTargetDate} onChange={(event)=>{setError("");setRenewTargetDate(event.target.value)}}/><small>Tanlangan sanagacha tarif va filial limiti uchun summa avtomatik hisoblanadi.</small></label>
        <div className="billing-period-shortcuts"><button type="button" onClick={()=>setRenewTargetDate(addBillingMonths(renewalBaseDate,1))}>+1 oy</button><button type="button" onClick={()=>setRenewTargetDate(addBillingMonths(renewalBaseDate,3))}>+3 oy</button><button type="button" onClick={()=>setRenewTargetDate(addBillingMonths(renewalBaseDate,6))}>+6 oy</button><button type="button" onClick={()=>setRenewTargetDate(addBillingMonths(renewalBaseDate,12))}>+12 oy</button></div>
        <div className="billing-renew-store-limit"><span><strong>Keyingi davr filial limiti</strong><small>{included} ta filial tarif ichida. Faol filiallaringiz sabab kamida {minimumRenewExtraStores} ta qo‘shimcha limit kerak.</small></span><div className="quantity-stepper"><button type="button" disabled={renewExtraStores<=minimumRenewExtraStores} onClick={()=>setRenewExtraStores(value=>Math.max(minimumRenewExtraStores,value-1))}>−</button><strong>{renewExtraStores}</strong><button type="button" onClick={()=>setRenewExtraStores(value=>Math.min(20,value+1))}>+</button></div></div>
      </div>
      <div className="billing-renew-summary">
        <div><span>Tarif</span><strong>{currentPlanLabel}</strong></div><div><span>Yangi tugash sanasi</span><strong>{renewalDateValid?fmtDate(renewTargetDate):"Sana tanlang"}</strong></div><div><span>Davr</span><strong>{renewalDays} kun</strong></div><div><span>Keyingi filial limiti</span><strong>{renewalNextStoreLimit} ta</strong></div><div><span>Tarif summasi</span><strong>{billingPrice(renewalOrder.baseAmount)}</strong></div><div><span>Qo‘shimcha filiallar</span><strong>{renewExtraStores?`${renewExtraStores} ta · ${billingPrice(renewalOrder.extraStoreAmount)}`:"Yo‘q"}</strong></div><div className="billing-renew-total"><span>Jami</span><strong>{billingPrice(renewalOrder.amount)}</strong></div><small>{renewalBaseDate} → {renewTargetDate||"Sana tanlanmagan"}</small>
      </div>
    </div>
    {error&&<div className="pro-alert danger">{error}</div>}
    <div className="billing-flow-footer"><span>{renewalDays>0?`${renewalDays} kunlik uzaytirish`:"Sanani tanlang"}</span><button className="pro-btn primary" onClick={proceedRenew} disabled={!canWrite||!!hasPendingPayment||!renewalDateValid||preparing}>To‘lovga o‘tish</button></div>
  </section>;

  const plans=flow==="plans"&&<section className="pricing-section pro-card billing-flow-card">
    <div className="billing-flow-head"><button className="billing-back" onClick={()=>activation?null:leaveToOverview()} disabled={activation}><FiArrowLeft/></button><div><h2>{["ACTIVE","APPROVED","EXPIRED"].includes(status)?"Tarifni o‘zgartirish":"Tarifni tanlang"}</h2><p>Keyingi davr uchun tarifni tanlang. Joriy tarifni faqat muddatini uzaytirish uchun “Tarifni uzaytirish” oqimidan foydalaning.</p></div></div>
    {hasPendingPayment&&<div className="pro-alert warning">To‘lov tekshiruvda. Avval uning natijasini kuting.</div>}
    {error&&<div className="pro-alert danger">{error}</div>}
    <div className="pricing-grid">
      <button type="button" className={`pricing-card ${plan==="MONTHLY"?"selected":""}`} onClick={()=>{if(canWrite){setCheckoutDraft(null);setPlan("MONTHLY")}}}><div className="pricing-top"><span>Oylik</span>{plan==="MONTHLY"&&<FiCheck/>}</div><strong>{billingPrice(BILLING_CONFIG.monthly.amount)}</strong><small>/ oy</small><ul><li><FiCheck/> {BILLING_CONFIG.monthly.includedStores} ta filial</li><li><FiCheck/> Barcha asosiy modullar</li><li><FiCheck/> Har oy yangilanadi</li></ul></button>
      <button type="button" className={`pricing-card featured ${plan==="ANNUAL"?"selected":""}`} onClick={()=>{if(canWrite){setCheckoutDraft(null);setPlan("ANNUAL")}}}><span className="best-badge"><FiGift/> Tejamkor</span><div className="pricing-top"><span>Yillik</span>{plan==="ANNUAL"&&<FiCheck/>}</div><strong>{billingPrice(BILLING_CONFIG.annual.amount)}</strong><small>/ 12 oy · oyiga {billingPrice(annualMonthlyEquivalent)}</small><div className="saving-pill">{billingPrice(BILLING_CONFIG.annual.saving)} tejaysiz</div><ul><li><FiCheck/> {BILLING_CONFIG.annual.includedStores} ta filial</li><li><FiCheck/> Barcha asosiy modullar</li><li><FiCheck/> 12 oyga bitta to‘lov</li></ul></button>
    </div>
    <div className="pro-card" style={{marginTop:12,padding:14}}><label className="pro-field"><span>Promokod (ixtiyoriy)</span><input value={promoCode} onChange={e=>{setPromoCode(e.target.value.toUpperCase());setPromoPreview(null)}} placeholder="ZENIX-FREE30"/></label><button type="button" className="pro-btn secondary" disabled={!promoCode.trim()||promoBusy} onClick={verifyPromo}>Promokodni tekshirish</button>{promoPreview&&<div className="pro-alert success" style={{marginTop:10}}>{promoPreview.percent}% chegirma · {billingPrice(promoPreview.due)}{promoPreview.percent===100&&<button className="pro-btn primary" onClick={redeemFree} disabled={promoBusy}>Bepul faollashtirish</button>}</div>}</div>
    {purchasedExtras>0&&<div className="billing-renewal-extra"><FiMapPin/><span><strong>{purchasedExtras} ta qo‘shimcha filial limiti keyingi davrda ham davom etadi.</strong><small>Qo‘shimcha filiallar: {billingPrice(renewalExtraAmount)} · Jami: {billingPrice(checkoutOrder.amount)}</small></span></div>}
    <div className="billing-flow-footer"><span>Jami: <strong>{billingPrice(checkoutOrder.amount)}</strong></span><button className="pro-btn primary" onClick={proceedPlan} disabled={!canWrite||!!hasPendingPayment||preparing}>Davom etish</button></div>
  </section>;

  const payment=flow==="payment"&&<section className="pro-card billing-checkout-card">
    <div className="billing-flow-head"><button className="billing-back" onClick={back}><FiArrowLeft/></button><div><h2>{paymentType==="EXTRA"?"Filial limitini oshirish":"To‘lov"}</h2><p>Rekvizitlarni tekshiring, to‘lovni qiling va chekni biriktiring.</p></div></div>
    {paymentType==="EXTRA"&&<><div className="billing-extra-quantity"><div><span>Qo‘shimcha filial</span><small>Filiallar sonini va xizmat muddatini tanlang.</small></div><div className="quantity-stepper"><button disabled={preparing||extraStores<=1} onClick={()=>void changeExtraStoreCount(extraStores-1)}>−</button><strong>{extraStores}</strong><button disabled={preparing||extraStores>=20} onClick={()=>void changeExtraStoreCount(extraStores+1)}>+</button></div></div><label className="pro-field"><span>Qo‘shimcha filial muddati</span><PremiumSelect className="pro-select" disabled={preparing} value={extraDuration} onChange={(event)=>void changeExtraStoreCount(extraStores,event.target.value)}><option value="UNTIL_LICENSE">Asosiy tarif tugaguncha (oyma-oy)</option><option value="MONTHLY">1 oy</option><option value="ANNUAL">1 yil</option></PremiumSelect></label></>}
    <div className="billing-checkout-layout">
      <div className="billing-order-clean"><div><span>{paymentType==="EXTRA"?"Filial limiti":"Tarif"}</span><strong>{paymentType==="EXTRA"?`+${extraStores} ta filial`:BILLING_PLANS[plan].label}</strong></div>{paymentType==="LICENSE"&&Number(checkoutOrder.renewalExtraStores||0)>0&&<div><span>Qo‘shimcha filiallar</span><strong>{checkoutOrder.renewalExtraStores} ta · {billingPrice(checkoutOrder.extraStoreAmount||0)}</strong></div>}{checkoutOrder.servicePeriodFrom&&checkoutOrder.servicePeriodTo&&<div><span>Xizmat davri</span><strong>{fmtDate(checkoutOrder.servicePeriodFrom)} → {fmtDate(checkoutOrder.servicePeriodTo)}</strong></div>}<div><span>To‘lov summasi</span><strong className="billing-total-clean">{billingPrice(checkoutOrder.amount)}</strong></div><small>{paymentType==="EXTRA"?"Tanlangan muddat va yakuniy summa serverda hisoblandi. Muddat tugagach qo‘shimcha filial limiti yangilanadi.":checkoutOrder.extensionDays?`${checkoutOrder.extensionDays} kun uchun avtomatik hisoblandi.`:"Tasdiqlangach tarif ma’lumotlari avtomatik yangilanadi."}</small></div>
      <div className="billing-pay-clean">
        <div className="billing-copy-row"><span>Karta</span><strong>{BILLING_CONFIG.manualPayment.cardNumber}</strong><button onClick={()=>copy("card",BILLING_CONFIG.manualPayment.cardNumber)}>{copied==="card"?<FiCheck/>:<FiCopy/>}</button></div>
        <div className="billing-copy-row"><span>Summa</span><strong>{billingPrice(checkoutOrder.amount)}</strong><button onClick={()=>copy("amount",checkoutOrder.amount)}>{copied==="amount"?<FiCheck/>:<FiCopy/>}</button></div>
        <details className="billing-details"><summary>To‘lov tafsilotlari</summary><div><span>Karta egasi</span><strong>{BILLING_CONFIG.manualPayment.cardHolder}</strong></div><div><span>Buyurtma ID</span><strong>{checkoutOrder.orderId}</strong></div><div><span>Maqsad</span><strong>{BILLING_CONFIG.manualPayment.purposePrefix} · {checkoutOrder.purpose}</strong></div></details>
        <div className="billing-receipt-upload"><FilePicker file={file} accept=".jpg,.jpeg,.png,.pdf,application/pdf,image/*" label="To‘lov chekini tanlash" hint="JPG, PNG yoki PDF · maksimum 5MB" onChange={choose} onClear={()=>setFile(null)}/>{preview&&<div className="billing-receipt-live-preview"><img src={preview} alt="Chek ko‘rinishi"/><span>Chek ko‘rinishi</span></div>}</div>
        {error&&<div className="pro-alert danger">{error}</div>}
        <button className="pro-btn primary payment-submit" disabled={!file||submitting||!canWrite} onClick={submit}>{submitting?"Yuborilmoqda...":"To‘lovni tekshiruvga yuborish"}</button>
      </div>
    </div>
  </section>;

  const waiting=flow==="waiting"&&<section className="pro-card billing-wait-card">
    <div className="billing-wait-icon"><FiClock/></div>
    <StatusBadge tone="warning">Tasdiqlash kutilmoqda</StatusBadge>
    <h2>To‘lovingiz tekshirilmoqda</h2>
    <p>Chek muvaffaqiyatli yuborildi. Administrator tasdiqlashi bilan Zenix POS avtomatik ravishda ochiladi.</p>
    <div className="billing-wait-steps">
      <div className="done"><span><FiCheck/></span><div><strong>1. Chek yuborildi</strong><small>To‘lov ma’lumotlari qabul qilindi</small></div></div>
      <div className="active"><span><FiClock/></span><div><strong>2. To‘lov tekshirilmoqda</strong><small>Holat avtomatik yangilanadi</small></div></div>
      <div><span><FiCheckCircle/></span><div><strong>3. Tasdiqlash kutilmoqda</strong><small>Tasdiqlangach platforma avtomatik ochiladi</small></div></div>
    </div>
    <div className="billing-wait-live"><span className="billing-wait-dot"/> Sahifani yopmang — holat har 2 soniyada tekshirilmoqda</div>
  </section>;

  const content=<div className="pro-page billing-pro">
    <PageHeader title={activation?"Tarifni aktivlashtirish":"Tarif va to‘lovlar"} subtitle={activation?"Tarifni tanlang va to‘lov chekini yuboring.":"Joriy tarif, filial limiti va to‘lovlar tarixi."} actions={!activation&&<StatusBadge tone={statusTone(status)}>{statusLabel}</StatusBadge>}/>
    {currentOrg?.settings?.billingNotice&&<div className="pro-alert warning"><FiShield/><div><strong>Platforma administratori xabari</strong><span>{currentOrg.settings.billingNotice}</span></div></div>}
    {currentOrg?.settings?.billingHold&&<div className="pro-alert danger"><FiLock/><div><strong>To‘lovgacha vaqtincha cheklangan</strong><span>Boshqaruv paneli va Billing ochiq qoladi. Obunani faollashtiring yoki administratorga murojaat qiling.</span></div></div>}
    {currentOrg?.settings?.trialEndsAt&&["ACTIVE","APPROVED"].includes(status)&&<div className="billing-renewal-reminder"><FiClock/><span><strong>14 kunlik sinov muddati</strong><small>{(()=>{const seconds=Math.max(0,Math.ceil((new Date(currentOrg.settings.trialEndsAt).getTime()-now)/1000));return `${Math.floor(seconds/86400)} kun ${Math.floor(seconds%86400/3600)} soat ${Math.floor(seconds%3600/60)} daqiqa ${seconds%60} soniya qoldi`})()}</small></span>{canWrite&&<button className="pro-btn secondary" onClick={startPlan}>Tarif tanlash</button>}</div>}
    {status==="EXPIRED"&&<div className="pro-alert danger"><FiClock/><div><strong>Tarif muddati tugagan</strong><span>Platformadan foydalanishni davom ettirish uchun tarifni uzaytiring.</span></div></div>}
    {!activation&&["ACTIVE","APPROVED"].includes(status)&&expiry&&daysUntil(expiry)<=30&&<div className="billing-renewal-reminder"><FiClock/><span><strong>Tarif muddati yaqinlashmoqda</strong><small>{daysUntil(expiry)} kun qoldi · hozir uzaytirsangiz yangi davr joriy muddat tugaganidan keyin boshlanadi.</small></span>{canWrite&&<button className="pro-btn secondary" onClick={startRenew}>Uzaytirish</button>}</div>}
    {status==="REJECTED"&&!(["ACTIVE","APPROVED"].includes(storedStatus))&&<div className="pro-alert danger">Oxirgi to‘lov rad etildi. Sabab: {latestLicensePayment?.rejectReason||"To‘lov ma’lumotlarini tekshirib, yangi chek yuboring."}</div>}
    {pendingLicense&&<div className="pro-alert warning"><FiClock/><div><strong>Tarif to‘lovi tekshiruvda</strong><span>{["ACTIVE","APPROVED"].includes(status)?"Joriy tarifingiz tekshiruv davomida ishlashda davom etadi.":"Tasdiqlangach platformadan foydalanish avtomatik ochiladi."}</span></div></div>}
    {pendingExtra&&<div className="pro-alert info"><FiClock/><div><strong>Filial limiti to‘lovi tekshiruvda</strong><span>Tasdiqlangach limit avtomatik oshadi.</span></div></div>}
    {readonly&&!activation&&<div className="pro-alert info">Siz tarif va to‘lov ma’lumotlarini ko‘ra olasiz. To‘lov yuborish uchun “Tarif va to‘lovlarni boshqarish” ruxsati kerak.</div>}

    {waiting||<>{overview}{renew}{plans}{payment}</>}

    {!activation&&<section className="pro-card billing-history"><div className="pro-card-head"><div><h2>To‘lovlar tarixi</h2><p>Tarif va filial limiti bo‘yicha yuborilgan to‘lovlar.</p></div><ColumnPicker columns={billingColumnDefs} visible={billingColumns} onToggle={toggleBillingColumn}/></div><div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Buyurtma</th><th>Sana</th>{showBillingColumn("purpose")&&<th>Maqsad</th>}{showBillingColumn("period")&&<th>Davr</th>}{showBillingColumn("amount")&&<th>Summa</th>}{showBillingColumn("status")&&<th>Holat</th>}{showBillingColumn("receipt")&&<th>Chek</th>}</tr></thead><tbody>{history.length?history.map(item=><tr key={item.id||item.orderId}><td data-label="Buyurtma"><strong>{billingPaymentLabel(item)}</strong></td><td data-label="Sana">{fmtDate(item.submittedAt)}</td>{showBillingColumn("purpose")&&<td data-label="Maqsad">{item.purpose}</td>}{showBillingColumn("period")&&<td data-label="Davr">{item.servicePeriodFrom&&item.servicePeriodTo?<><strong>{fmtDate(item.servicePeriodFrom)}</strong><small>→ {fmtDate(item.servicePeriodTo)}</small></>:"—"}</td>}{showBillingColumn("amount")&&<td data-label="Summa">{billingPrice(item.amount)}</td>}{showBillingColumn("status")&&<td data-label="Holat"><StatusBadge tone={statusTone(item.status)}>{STATUS_LABELS[item.status]||item.status}</StatusBadge></td>}{showBillingColumn("receipt")&&<td data-label="Chek">{item.receiptName?<button className="pro-btn ghost" onClick={()=>openReceipt(item)}><FiEye/> Ko‘rish</button>:"—"}</td>}</tr>):<tr><td colSpan={billingColumns.length+2}><div className="pro-empty"><FiFileText/><strong>To‘lovlar hali yo‘q</strong><span>Birinchi to‘lov yuborilgach shu yerda ko‘rinadi.</span></div></td></tr>}</tbody></table></div></section>}

    <Modal open={!!receiptView} onClose={closeReceipt} title="To‘lov cheki" subtitle={billingPaymentLabel(receiptView)} size="sm"><div className="billing-receipt-preview">{receiptLoading?<div className="pro-empty"><FiClock/><strong>Chek ochilmoqda...</strong></div>:receiptUrl&&receiptView?.receiptType?.startsWith("image/")?<img src={receiptUrl} alt="To‘lov cheki"/>:receiptUrl&&receiptView?.receiptType==="application/pdf"?<iframe title="To‘lov cheki PDF" src={receiptUrl}/>:<FiFileText/>}<strong>{receiptView?.receiptName||"To‘lov cheki"}</strong><span>{billingPrice(receiptView?.amount||0)}</span></div></Modal>
  </div>;

  if(!activation)return content;
  return <div className="activation-shell"><div className="activation-top"><div className="activation-brand"><span className="pos-logo-mark">Z</span> ZENIX POS</div><button onClick={logout}>Chiqish</button></div>{content}</div>;
}
export default Billing;
