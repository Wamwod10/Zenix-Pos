import SubscriptionPlans from '../../components/SubscriptionPlans';
import {RESOURCE_LABELS,subscriptionAction,subscriptionSummary,subscriptionDraftUsable} from '../../utils/subscription';
import {workspaceAccessState} from '../../utils/license';
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft, FiCheck, FiClock, FiCopy, FiCreditCard, FiEye, FiFileText,
  FiMapPin, FiShield, FiCheckCircle,FiLock,
} from "react-icons/fi";
import { BILLING_CONFIG, BILLING_PLANS, billingDaysBetween } from "../../config/billing";
import { api } from "../../services/apiClient";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { FilePicker, PageHeader, StatusBadge, PremiumSelect, ColumnPicker } from "../../components/Ui";
import Modal from "../../components/Modal";
import { useFeedback } from "../../context/FeedbackContext";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { billingPaymentReviewState, hasPendingBillingPayment, startBillingPaymentPolling } from "./billingPolling";

const STATUS_LABELS={ACTIVE:"Faol",APPROVED:"Faol",REVIEW:"Tekshiruvda",REJECTED:"Rad etildi",EXPIRED:"Muddati tugagan",SUSPENDED:"Administrator tomonidan bloklangan",PAYMENT_REQUIRED:"To‘lov kutilmoqda",PENDING:"Kutilmoqda"};
const statusTone=status=>["ACTIVE","APPROVED"].includes(status)?"success":status==="REJECTED"||status==="EXPIRED"||status==="SUSPENDED"?"danger":status==="REVIEW"?"warning":"neutral";
const fmtDate=value=>value?new Date(value).toLocaleDateString("uz-UZ",{timeZone:'Asia/Tashkent'}):"—";
const billingPrice=value=>`${new Intl.NumberFormat('uz-UZ',{maximumFractionDigits:2}).format(Number(value||0))} so‘m`;
const localDateISO=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
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
  const [catalog,setCatalog]=useState([]);
  const [subscription,setSubscription]=useState(null);
  const [resources,setResources]=useState({});
  const [catalogError,setCatalogError]=useState('');
  const [planCode,setPlanCode]=useState(currentOrg?.planCode||'BUSINESS');
  const refreshSubscription=async()=>{
    try{
      const [plansData,stateData,usageData]=await Promise.all([api.get('/api/billing/plans'),api.get('/api/billing/subscription'),api.get('/api/billing/limits')]);
      if(!Array.isArray(plansData.plans)||!stateData.subscription||!usageData.resources)throw new Error('Tarif ma’lumotlari mavjud emas');
      setCatalog(plansData.plans);setSubscription(stateData.subscription);setResources(usageData.resources);setCatalogError('');
    }catch(e){setSubscription(null);setCatalogError(e.message||'Tarif ma’lumotlarini yuklab bo‘lmadi')}
  };
  useEffect(()=>{setPlanCode(currentOrg?.planCode||'BUSINESS');void refreshSubscription()},[currentOrg?.planCode,currentOrg?.version,currentOrg?.accessMode]);
  useEffect(()=>{const timer=setInterval(()=>void refreshSubscription(),30000);return()=>clearInterval(timer)},[]);
  const expiry=currentOrg?.expiryDate||null;
  const storedStatus=String(currentOrg?.licenseStatus||latestLicensePayment?.status||(activation?"PAYMENT_REQUIRED":"ACTIVE")).toUpperCase();
  const expired=workspaceAccessState({organization:currentOrg,now:Date.now()+(currentOrg?.serverClockOffset||0)}).reason==='EXPIRED';
  const status=(["ACTIVE","APPROVED"].includes(storedStatus)&&expired)?"EXPIRED":storedStatus;
  const canWrite=activation||hasPermission("billingWrite",currentUser?.appRole);
  const readonly=!canWrite;
  const currentPlan=currentOrg?.plan&&BILLING_PLANS[currentOrg.plan]?currentOrg.plan:(latestLicensePayment?.plan&&BILLING_PLANS[latestLicensePayment.plan]?latestLicensePayment.plan:"ANNUAL");
  const included=subscription?.legacy?(BILLING_PLANS[currentPlan]||BILLING_PLANS.ANNUAL).includedStores:subscription?.limits?.stores??currentOrg?.limits?.stores??(BILLING_PLANS[currentPlan]||BILLING_PLANS.ANNUAL).includedStores;
  const used=resources.stores?.used??stores.length;
  const storeLimit=resources.stores?.limit??subscription?.limits?.stores??Number(currentOrg?.storeLimit||included);
  const purchasedExtras=currentOrg?.planCode&&!currentOrg.legacy?0:Math.max(0,Number(currentOrg?.purchasedExtraStores??(Number(currentOrg?.baseStoreLimit??storeLimit)-included)));
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  const [flow,setFlow]=useState(()=>paymentReviewState==="waiting"?"waiting":activation||["PAYMENT_REQUIRED","REJECTED"].includes(status)?"plans":status==="EXPIRED"?"plans":"overview");
  const [plan,setPlan]=useState(currentPlan);
  const [licenseIntent,setLicenseIntent]=useState(()=>activation||!["ACTIVE","APPROVED","EXPIRED"].includes(status)?"ACTIVATE":"RENEW");
  const [paymentType,setPaymentType]=useState("LICENSE");
  const [extraStores,setExtraStores]=useState(1);
  const [extraDuration,setExtraDuration]=useState("UNTIL_LICENSE");
  const [promoCode,setPromoCode]=useState("");
  const [promoPreview,setPromoPreview]=useState(null);
  const freeRequestRef=useRef(null);
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
  const billingFlowDirty=(flow==='plans'&&(plan!==currentPlan||planCode!==subscription?.planCode||Boolean(promoCode)))||(flow==='payment'&&Boolean(file));
  const guardBillingExit=useUnsavedGuard(billingFlowDirty,"Tarif yoki to‘lov bo‘yicha kiritilgan o‘zgarishlar saqlanmagan. Chiqsangiz, ular yo‘qoladi.");

  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
  useEffect(()=>{setPlan(currentPlan)},[currentPlan]);
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
      const draft=result?.draft;if(!active)return;if(result?.stale)setError('Oldingi hisob eskirgan. Yangi hisobni tayyorlang.');if(!draft||hasPendingPayment)return;
      if(draft.planCode)setPlanCode(draft.planCode);
      setCheckoutDraft(draft);setPaymentType(draft.type||"LICENSE");setPlan(draft.plan||currentPlan);setLicenseIntent(draft.intent||draft.metadata?.intent||"RENEW");
      if(draft.type==="EXTRA"){
        setExtraStores(Math.max(1,Number(draft.extraStoreCount||1)));
        setExtraDuration(draft.metadata?.extraDuration||"UNTIL_LICENSE");
      }
      setFlow("payment");
    });
    return()=>{active=false};
  // load one open checkout only when the billing screen is entered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const checkoutOrder=checkoutDraft?.order||{};
  const quoteSummary=subscriptionSummary(checkoutDraft);
  const draftUsable=subscriptionDraftUsable(checkoutDraft,subscription,now+(currentOrg?.serverClockOffset||0));
  const selectedTier=catalog.find(item=>item.code===planCode);
  const tierAction=subscriptionAction(subscription,planCode,catalog);
  const trialActive=tierAction==='TRIAL';
  const scheduledTarget=subscription?.scheduledDowngrade?.planCode===planCode;
  const changeSubscription=async(path,payload)=>{
    setPreparing(true);setError('');
    try{await api.post(path,payload);await reloadStore();await refreshSubscription();setFlow('overview');notify({tone:'success',title:path.includes('trial')?'Trial tarifi o‘zgartirildi':'Tarif o‘zgarishi saqlandi'})}
    catch(e){setError(e.message)}finally{setPreparing(false)}
  };

  const verifyPromo=async()=>{setPromoBusy(true);setError("");try{const data=await api.post("/api/billing/promo/preview",{code:promoCode.trim(),plan,planCode});setPromoPreview(data.promo||null)}catch(e){setPromoPreview(null);setError(e?.message||"Promokod yaroqsiz") }finally{setPromoBusy(false)}};
  const redeemFree=async()=>{if(promoBusy)return;const key=`${promoCode.trim()}:${planCode}:${plan}`;if(freeRequestRef.current?.key!==key)freeRequestRef.current={key,id:crypto.randomUUID()};setPromoBusy(true);setError("");try{await api.post("/api/billing/promo/redeem-free",{code:promoCode.trim(),plan,planCode,requestId:freeRequestRef.current.id});await reloadStore();setPromoCode("");setPromoPreview(null);setFlow("overview");notify({tone:"success",title:"Bepul tarif faollashdi"});if(activation)navigate("/",{replace:true})}catch(e){setError(e?.message||"Promokodni ishlatib bo‘lmadi")}finally{setPromoBusy(false)}};
  const copy=async(key,value)=>{try{await navigator.clipboard.writeText(String(value));setCopied(key);setTimeout(()=>setCopied(""),1400)}catch{setCopied("");notify({tone:"danger",title:"Nusxalab bo‘lmadi",message:"Qiymatni qo‘lda belgilang yoki brauzerda nusxalashga ruxsat bering."})}};
  const choose=fileValue=>{setError("");if(!fileValue)return;if(!BILLING_CONFIG.receipt.accepted.includes(fileValue.type)){setError("Faqat JPG, PNG yoki PDF qabul qilinadi");return}if(fileValue.size>BILLING_CONFIG.receipt.maxBytes){setError("Fayl hajmi 5MB dan oshmasligi kerak");return}setFile(fileValue)};
  const discardDraft=async()=>{const id=checkoutDraft?.id||billingDraft?.id;if(id)await cancelBillingDraft(id);setCheckoutDraft(null)};
  const startRenew=()=>{if(!canWrite)return;void discardDraft();setPaymentType('LICENSE');setLicenseIntent('RENEW');setPlanCode(subscription?.scheduledDowngrade?.planCode||subscription?.planCode||currentOrg?.planCode||'BUSINESS');setPlan(subscription?.billingInterval||'MONTHLY');setError('');setFile(null);setPromoPreview(null);setFlow('plans')};
  const startPlan=()=>{if(!canWrite)return;void discardDraft();setPaymentType('LICENSE');setLicenseIntent('CHANGE_PLAN');setPlanCode(subscription?.planCode||currentOrg?.planCode||'BUSINESS');setPlan(subscription?.billingInterval||'MONTHLY');setError('');setFile(null);setPromoPreview(null);setFlow('plans')};
  const proceedPlan=async()=>{
    if(!canWrite||hasPendingPayment||preparing||!selectedTier||!subscription)return;
    setPreparing(true);setError('');setPaymentType('LICENSE');
    const intent=trialActive||subscription?.accessMode!=='READ_WRITE'?'ACTIVATE':tierAction==='UPGRADE'?'CHANGE_PLAN':'RENEW';
    const result=await createBillingDraft({type:'LICENSE',planCode,billingInterval:plan,intent,promoCode:promoCode.trim(),metadata:{source:'tier_checkout'}});
    setPreparing(false);if(!result?.success){setError(result?.message||'To‘lov hisobini tayyorlab bo‘lmadi');return}
    setLicenseIntent(intent);setCheckoutDraft(result.draft);setFlow('payment');
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
  const leaveToOverview=()=>guardBillingExit(()=>{void discardDraft();setFile(null);setError("");setPlan(currentPlan);setFlow("overview")});
  const back=()=>guardBillingExit(()=>{setFile(null);setError("");if(paymentType==="LICENSE"&&flow==="payment")setFlow("plans");else {void discardDraft();setFlow("overview")}});


  const submit=async()=>{
    if(submitting||!canWrite||!draftUsable)return;
    const duplicate=history.find(payment=>payment.status==="REVIEW");
    if(duplicate){setError("Boshqa to‘lov tekshiruvda. Avval uni yakunlang.");return}
    if(!file&&Number(checkoutDraft?.totalAmount)!==0){setError("To‘lov chekini yuklang");return}
    setSubmitting(true);setError("");
    try{
      const draft=checkoutDraft;
      if(!draft?.id){setError("To‘lov drafti topilmadi. Qayta urinib ko‘ring.");return}
      const result=await commitBillingSubmission({draftId:draft.id,file});
      if(!result?.success){setError(result?.message||"To‘lovni yuborib bo‘lmadi.");return}
      const approved=result.payment?.status==='APPROVED';
      const isExtra=paymentType==="EXTRA";
      setFile(null);setCheckoutDraft(null);setFlow(isExtra||approved?"overview":"waiting");if(approved){await reloadStore();await refreshSubscription();if(activation)navigate("/",{replace:true})};
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
  const currentPlanLabel=catalog.find(item=>item.code===subscription?.planCode)?.label||subscription?.planCode||currentOrg?.planCode||"Business";
  const nextAmount=catalog.find(item=>item.code===(subscription?.scheduledDowngrade?.planCode||subscription?.planCode))?.prices[subscription?.billingInterval||'MONTHLY'];

  const overview=!activation&&flow==="overview"&&<>
    <section className="pro-card billing-current-card">
      <div className="billing-current-main"><div className="billing-plan-mark"><FiShield/></div><div><div className="billing-current-title"><h2>{currentPlanLabel} tarif</h2><StatusBadge tone={statusTone(status)}>{statusLabel}</StatusBadge></div><p>{expiry?`${fmtDate(expiry)} gacha amal qiladi`:"Tarif muddati belgilanmagan"}</p></div></div>
      <div className="billing-current-metrics"><div><span>Qolgan muddat</span><strong>{expiry?`${daysUntil(expiry)} kun`:"—"}</strong></div><div><span>Filiallar</span><strong>{used} / {storeLimit}</strong></div><div><span>Keyingi davr</span><strong>{billingPrice(nextAmount)}</strong></div></div>
      <div className="billing-current-actions">{canWrite&&<button className="pro-btn primary" disabled={!!hasPendingPayment} onClick={startRenew}>{hasPendingPayment?"To‘lov tekshiruvda":"Tarifni uzaytirish"}</button>} {canWrite&&<button className="pro-btn secondary" disabled={!!hasPendingPayment} onClick={startPlan}>Tarifni o‘zgartirish</button>}</div>
    </section>
    <div className="billing-secondary-grid">
      <section className="pro-card billing-branch-card"><div className="billing-mini-icon"><FiMapPin/></div><div><span>Filial limiti</span><strong>{used} ta ishlatilmoqda · {storeLimit} ta limit</strong><small>{included} ta tarifda{purchasedExtras?` · ${purchasedExtras} ta qo‘shimcha`:""}</small></div></section>
      <section className="pro-card billing-next-card"><div className="billing-mini-icon"><FiCreditCard/></div><div><span>Keyingi to‘lov</span><strong>{expiry?fmtDate(expiry):"Aktivatsiyadan so‘ng"}</strong><small>{billingPrice(nextAmount)} · {currentPlanLabel.toLowerCase()}</small></div></section>
    </div>
  </>;

  const plans=flow==='plans'&&<section className="pricing-section pro-card billing-flow-card">
    <div className="billing-flow-head">{!activation&&<button className="billing-back" onClick={leaveToOverview} aria-label="Orqaga"><FiArrowLeft/></button>}<div><h2>Biznesingiz uchun tarif</h2><p>Barcha standart POS modullari har bir tarifda ochiq.</p></div></div>
    <div className="pro-segmented subscription-interval" role="group" aria-label="To‘lov davri">{[['MONTHLY','Oylik'],['ANNUAL','Yillik']].map(([code,label])=><button key={code} type="button" className={plan===code?'active':''} aria-pressed={plan===code} disabled={preparing} onClick={()=>{setPlan(code);setPromoPreview(null)}}>{label}</button>)}</div>
    <SubscriptionPlans plans={catalog} value={planCode} interval={plan} disabled={!canWrite||preparing} onChange={code=>{setPlanCode(code);setPromoPreview(null);setError('')}}/>
    {trialActive&&<div className="pro-alert info">Tanlangan tarifda trial {fmtDate(subscription.trialEndsAt)} kuni tugaydi. Tarifni almashtirish 14 kunlik muddatni qayta boshlamaydi. <button className="pro-btn secondary" disabled={!canWrite||preparing||planCode===subscription.planCode||hasPendingPayment} onClick={()=>changeSubscription('/api/billing/trial-plan',{planCode})}>Trial tarifini almashtirish</button></div>}
    {tierAction==='UPGRADE'&&<div className="pro-alert info">Foydalanilmagan to‘langan muddat qiymati serverda hisoblanib, buyurtmadan ayriladi. Yangi tarif to‘lov tasdiqlangach kuchga kiradi.</div>}
    {tierAction==='DOWNGRADE'&&<div className="pro-alert warning">Pastroq tarif joriy to‘langan muddat tugagach kuchga kiradi. Ma’lumotlar va tarix saqlanadi. {!scheduledTarget&&<button className="pro-btn secondary" disabled={!canWrite||preparing||hasPendingPayment} onClick={()=>changeSubscription('/api/billing/downgrade',{planCode})}>Downgrade rejalashtirish</button>}</div>}
    <div className="pro-card" style={{marginTop:12,padding:14}}><label className="pro-field"><span>Promokod (ixtiyoriy)</span><input value={promoCode} onChange={e=>{setPromoCode(e.target.value.toUpperCase());setPromoPreview(null)}} placeholder="Promokod"/></label><button type="button" className="pro-btn secondary" disabled={!promoCode.trim()||promoBusy||!selectedTier||!subscription||(tierAction==='DOWNGRADE'&&!scheduledTarget)} onClick={verifyPromo}>Promokodni tekshirish</button>{promoPreview&&<div className="pro-alert success" style={{marginTop:10}}>{promoPreview.percent}% chegirma · {billingPrice(promoPreview.due)}{promoPreview.percent===100&&promoPreview.due===0&&<button className="pro-btn primary" onClick={redeemFree} disabled={!canWrite||promoBusy}>Bepul faollashtirish</button>}</div>}</div>
    {error&&<div className="pro-alert danger" role="alert">{error}</div>}
    <div className="billing-flow-footer"><span>Tarif narxi: <strong>{selectedTier?billingPrice(selectedTier.prices[plan]):'Yuklanmoqda...'}</strong><small> Kredit va chegirma keyingi server hisobida ko‘rsatiladi.</small></span><button className="pro-btn primary" onClick={proceedPlan} disabled={!canWrite||hasPendingPayment||preparing||!selectedTier||(tierAction==='DOWNGRADE'&&!scheduledTarget)}>To‘lov hisobini ko‘rish</button></div>
  </section>;

  const payment=flow==="payment"&&(!draftUsable?<section className="pro-card billing-checkout-card"><div className="pro-alert warning" role="alert">To‘lov hisobining muddati yoki obuna holati o‘zgargan. To‘lov qilishdan oldin yangi server hisobini oling.</div><button className="pro-btn primary" onClick={startPlan}>Hisobni qayta tayyorlash</button></section>:<section className="pro-card billing-checkout-card">
    <div className="billing-flow-head"><button type="button" className="billing-back" aria-label="Orqaga" title="Orqaga" onClick={back}><FiArrowLeft/></button><div><h2>{paymentType==="EXTRA"?"Filial limitini oshirish":"To‘lov"}</h2><p>Rekvizitlarni tekshiring, to‘lovni qiling va chekni biriktiring.</p></div></div>
    {paymentType==="EXTRA"&&<><div className="billing-extra-quantity"><div><span>Qo‘shimcha filial</span><small>Filiallar sonini va xizmat muddatini tanlang.</small></div><div className="quantity-stepper"><button type="button" aria-label="Qo‘shimcha filiallar sonini kamaytirish" disabled={preparing||extraStores<=1} onClick={()=>void changeExtraStoreCount(extraStores-1)}>−</button><strong>{extraStores}</strong><button type="button" aria-label="Qo‘shimcha filiallar sonini oshirish" disabled={preparing||extraStores>=20} onClick={()=>void changeExtraStoreCount(extraStores+1)}>+</button></div></div><label className="pro-field"><span>Qo‘shimcha filial muddati</span><PremiumSelect className="pro-select" disabled={preparing} value={extraDuration} onChange={(event)=>void changeExtraStoreCount(extraStores,event.target.value)}><option value="UNTIL_LICENSE">Asosiy tarif tugaguncha (oyma-oy)</option><option value="MONTHLY">1 oy</option><option value="ANNUAL">1 yil</option></PremiumSelect><small>{checkoutDraft?.metadata?.pricingRule||"Oylik va yillik narx qat'iy. Tarif tugaguncha boshlangan kalendar oy to'liq olinadi; har filial summasi eng yaqin 1 000 so'mga yaxlitlanadi."}</small></label></>}
    {quoteSummary&&<div className="billing-order-clean subscription-order-summary"><div><span>Tarif</span><strong>{catalog.find(item=>item.code===quoteSummary.planCode)?.label||quoteSummary.planCode}</strong></div><div><span>To‘lov davri</span><strong>{quoteSummary.billingInterval==='ANNUAL'?'Yillik':'Oylik'}</strong></div><div><span>Asosiy narx</span><strong>{billingPrice(quoteSummary.gross)}</strong></div><div><span>Foydalanilmagan muddat krediti</span><strong>−{billingPrice(quoteSummary.credit)}</strong></div><div><span>Promokod chegirmasi</span><strong>−{billingPrice(quoteSummary.discount)}</strong></div><div><span>Yakuniy to‘lov</span><strong>{billingPrice(quoteSummary.total)}</strong></div></div>}
    <div className="billing-checkout-layout">
      <div className="billing-order-clean"><div><span>{paymentType==="EXTRA"?"Filial limiti":"Tarif"}</span><strong>{paymentType==="EXTRA"?`+${extraStores} ta filial`:(catalog.find(item=>item.code===checkoutDraft?.planCode)?.label||BILLING_PLANS[plan]?.label)}</strong></div>{paymentType==="LICENSE"&&Number(checkoutOrder.renewalExtraStores||0)>0&&<div><span>Qo‘shimcha filiallar</span><strong>{checkoutOrder.renewalExtraStores} ta · {billingPrice(checkoutOrder.extraStoreAmount||0)}</strong></div>}{checkoutOrder.servicePeriodFrom&&checkoutOrder.servicePeriodTo&&<div><span>Xizmat davri</span><strong>{fmtDate(checkoutOrder.servicePeriodFrom)} → {fmtDate(checkoutOrder.servicePeriodTo)}</strong></div>}<div><span>To‘lov summasi</span><strong className="billing-total-clean">{billingPrice(checkoutOrder.amount)}</strong></div><small>{paymentType==="EXTRA"?"Tanlangan muddat va yakuniy summa serverda hisoblandi. Muddat tugagach qo‘shimcha filial limiti yangilanadi.":checkoutOrder.extensionDays?`${checkoutOrder.extensionDays} kun uchun avtomatik hisoblandi.`:"Tasdiqlangach tarif ma’lumotlari avtomatik yangilanadi."}</small></div>
      <div className="billing-pay-clean">
        <div className="billing-copy-row"><span>Karta</span><strong>{BILLING_CONFIG.manualPayment.cardNumber}</strong><button type="button" aria-label={copied==="card"?"Karta raqami nusxalandi":"Karta raqamini nusxalash"} title="Karta raqamini nusxalash" onClick={()=>copy("card",BILLING_CONFIG.manualPayment.cardNumber)}>{copied==="card"?<FiCheck/>:<FiCopy/>}</button></div>
        <div className="billing-copy-row"><span>Summa</span><strong>{billingPrice(checkoutOrder.amount)}</strong><button type="button" aria-label={copied==="amount"?"To‘lov summasi nusxalandi":"To‘lov summasini nusxalash"} title="To‘lov summasini nusxalash" onClick={()=>copy("amount",checkoutOrder.amount)}>{copied==="amount"?<FiCheck/>:<FiCopy/>}</button></div>
        <details className="billing-details"><summary>To‘lov tafsilotlari</summary><div><span>Karta egasi</span><strong>{BILLING_CONFIG.manualPayment.cardHolder}</strong></div><div><span>Buyurtma ID</span><strong>{checkoutOrder.orderId}</strong></div><div><span>Maqsad</span><strong>{BILLING_CONFIG.manualPayment.purposePrefix} · {checkoutOrder.purpose}</strong></div></details>
        <div className="billing-receipt-upload" hidden={Number(checkoutDraft?.totalAmount)===0}><FilePicker file={file} accept=".jpg,.jpeg,.png,.pdf,application/pdf,image/*" label="To‘lov chekini tanlash" hint="JPG, PNG yoki PDF · maksimum 5MB" onChange={choose} onClear={()=>setFile(null)}/>{preview&&<div className="billing-receipt-live-preview"><img src={preview} alt="Chek ko‘rinishi"/><span>Chek ko‘rinishi</span></div>}</div>
        {error&&<div className="pro-alert danger">{error}</div>}
        <button className="pro-btn primary payment-submit" disabled={(!file&&Number(checkoutDraft?.totalAmount)!==0)||submitting||!canWrite} onClick={submit}>{submitting?"Yuborilmoqda...":"To‘lovni tekshiruvga yuborish"}</button>
      </div>
    </div>
  </section>);

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
    {catalogError&&<div className="pro-alert danger" role="alert">{catalogError} <button className="pro-btn secondary" onClick={refreshSubscription}>Qayta urinish</button></div>}
    {subscription?.accessMode==='READ_ONLY'&&<div className="pro-alert warning" role="status"><FiLock/><div><strong>Faqat ko‘rish rejimi</strong><span>Trial yoki obuna tugagan, yoxud billing cheklovi bor. Ma?lumotlarni ko‘rish va to‘lov yuborish mumkin. Biznes ma’lumotlarini o‘zgartirish uchun obunani faollashtiring.</span></div></div>}
    {subscription?.scheduledDowngrade&&<div className="pro-alert info">{subscription.scheduledDowngrade.planCode} tarifi {fmtDate(subscription.scheduledDowngrade.effectiveOn)} kuni kuchga kiradi. <button className="pro-btn secondary" disabled={!canWrite||preparing||hasPendingPayment} onClick={()=>changeSubscription('/api/billing/downgrade/cancel',{})}>Rejani bekor qilish</button></div>}
    {Object.keys(resources).length>0&&<section className="pro-card subscription-usage"><div className="pro-card-head"><h2>Resurslardan foydalanish</h2></div><div className="subscription-usage-grid">{Object.entries(resources).map(([key,state])=><div key={key}><span>{RESOURCE_LABELS[key]}</span><strong>{state.used} / {state.limit??'Cheksiz'}</strong>{state.limit!==null&&<progress aria-label={RESOURCE_LABELS[key]} value={Math.min(state.used,state.limit)} max={state.limit}/>} {state.overLimit>0&&<small>Limitdan {state.overLimit} ta ortiq. Mavjud tarix saqlanadi.</small>}{state.upgradeRequired&&canWrite&&<button className="pro-btn secondary" onClick={startPlan}>Tarifni oshirish</button>}</div>)}</div></section>}
    {currentOrg?.settings?.billingNotice&&<div className="pro-alert warning"><FiShield/><div><strong>Platforma administratori xabari</strong><span>{currentOrg.settings.billingNotice}</span></div></div>}
    {currentOrg?.settings?.billingHold&&<div className="pro-alert danger"><FiLock/><div><strong>To‘lovgacha vaqtincha cheklangan</strong><span>Boshqaruv paneli va Billing ochiq qoladi. Obunani faollashtiring yoki administratorga murojaat qiling.</span></div></div>}
    {currentOrg?.settings?.trialEndsAt&&["ACTIVE","APPROVED"].includes(status)&&<div className="billing-renewal-reminder"><FiClock/><span><strong>14 kunlik sinov muddati</strong><progress aria-label="Sinov muddati" max={14*86400000} value={Math.max(0,Math.min(14*86400000,Date.parse(currentOrg.settings.trialEndsAt)-(now+(currentOrg.serverClockOffset||0))))}/><small>{(()=>{const seconds=Math.max(0,Math.ceil((new Date(currentOrg.settings.trialEndsAt).getTime()-(now+(currentOrg.serverClockOffset||0)))/1000));return `${Math.floor(seconds/86400)} kun ${Math.floor(seconds%86400/3600)} soat ${Math.floor(seconds%3600/60)} daqiqa ${seconds%60} soniya qoldi`})()}</small></span>{canWrite&&<button className="pro-btn secondary" onClick={startPlan}>Tarif tanlash</button>}</div>}
    {status==="EXPIRED"&&<div className="pro-alert danger"><FiClock/><div><strong>Tarif muddati tugagan</strong><span>Platformadan foydalanishni davom ettirish uchun tarifni uzaytiring.</span></div></div>}
    {!activation&&["ACTIVE","APPROVED"].includes(status)&&expiry&&daysUntil(expiry)<=30&&<div className="billing-renewal-reminder"><FiClock/><span><strong>Tarif muddati yaqinlashmoqda</strong><small>{daysUntil(expiry)} kun qoldi · hozir uzaytirsangiz yangi davr joriy muddat tugaganidan keyin boshlanadi.</small></span>{canWrite&&<button className="pro-btn secondary" onClick={startRenew}>Uzaytirish</button>}</div>}
    {status==="REJECTED"&&!(["ACTIVE","APPROVED"].includes(storedStatus))&&<div className="pro-alert danger">Oxirgi to‘lov rad etildi. Sabab: {latestLicensePayment?.rejectReason||"To‘lov ma’lumotlarini tekshirib, yangi chek yuboring."}</div>}
    {pendingLicense&&<div className="pro-alert warning"><FiClock/><div><strong>Tarif to‘lovi tekshiruvda</strong><span>{["ACTIVE","APPROVED"].includes(status)?"Joriy tarifingiz tekshiruv davomida ishlashda davom etadi.":"Tasdiqlangach platformadan foydalanish avtomatik ochiladi."}</span></div></div>}
    {pendingExtra&&<div className="pro-alert info"><FiClock/><div><strong>Filial limiti to‘lovi tekshiruvda</strong><span>Tasdiqlangach limit avtomatik oshadi.</span></div></div>}
    {readonly&&!activation&&<div className="pro-alert info">Siz tarif va to‘lov ma’lumotlarini ko‘ra olasiz. To‘lov yuborish uchun “Tarif va to‘lovlarni boshqarish” ruxsati kerak.</div>}

    {waiting||<>{overview}{plans}{payment}</>}

    {!activation&&<section className="pro-card billing-history"><div className="pro-card-head"><div><h2>To‘lovlar tarixi</h2><p>Tarif va filial limiti bo‘yicha yuborilgan to‘lovlar.</p></div><ColumnPicker columns={billingColumnDefs} visible={billingColumns} onToggle={toggleBillingColumn}/></div><div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Buyurtma</th><th>Sana</th>{showBillingColumn("purpose")&&<th>Maqsad</th>}{showBillingColumn("period")&&<th>Davr</th>}{showBillingColumn("amount")&&<th>Summa</th>}{showBillingColumn("status")&&<th>Holat</th>}{showBillingColumn("receipt")&&<th>Chek</th>}</tr></thead><tbody>{history.length?history.map(item=><tr key={item.id||item.orderId}><td data-label="Buyurtma"><strong>{billingPaymentLabel(item)}</strong></td><td data-label="Sana">{fmtDate(item.submittedAt)}</td>{showBillingColumn("purpose")&&<td data-label="Maqsad">{item.purpose}</td>}{showBillingColumn("period")&&<td data-label="Davr">{item.servicePeriodFrom&&item.servicePeriodTo?<><strong>{fmtDate(item.servicePeriodFrom)}</strong><small>→ {fmtDate(item.servicePeriodTo)}</small></>:"—"}</td>}{showBillingColumn("amount")&&<td data-label="Summa">{billingPrice(item.amount)}</td>}{showBillingColumn("status")&&<td data-label="Holat"><StatusBadge tone={statusTone(item.status)}>{STATUS_LABELS[item.status]||item.status}</StatusBadge></td>}{showBillingColumn("receipt")&&<td data-label="Chek">{item.receiptName?<button className="pro-btn ghost" onClick={()=>openReceipt(item)}><FiEye/> Ko‘rish</button>:"—"}</td>}</tr>):<tr><td colSpan={billingColumns.length+2}><div className="pro-empty"><FiFileText/><strong>To‘lovlar hali yo‘q</strong><span>Birinchi to‘lov yuborilgach shu yerda ko‘rinadi.</span></div></td></tr>}</tbody></table></div></section>}

    <Modal open={!!receiptView} onClose={closeReceipt} title="To‘lov cheki" subtitle={billingPaymentLabel(receiptView)} size="sm"><div className="billing-receipt-preview">{receiptLoading?<div className="pro-empty"><FiClock/><strong>Chek ochilmoqda...</strong></div>:receiptUrl&&receiptView?.receiptType?.startsWith("image/")?<img src={receiptUrl} alt="To‘lov cheki"/>:receiptUrl&&receiptView?.receiptType==="application/pdf"?<iframe title="To‘lov cheki PDF" src={receiptUrl}/>:<FiFileText/>}<strong>{receiptView?.receiptName||"To‘lov cheki"}</strong><span>{billingPrice(receiptView?.amount||0)}</span></div></Modal>
  </div>;

  if(!activation)return content;
  return <div className="activation-shell"><div className="activation-top"><div className="activation-brand"><span className="pos-logo-mark">Z</span> ZENIX POS</div><button onClick={logout}>Chiqish</button></div>{content}</div>;
}
export default Billing;
