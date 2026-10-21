import {useEffect,useRef,useState} from 'react';
import {validateSerialChoice} from './serialSelection';
import {api} from '../../services/apiClient';
import {posDraftKey,readPosDraft,savePosDraft,clearPosDraft,persistedCartIntent} from '../../utils/posDraft';
import {attemptKey,readAttempt,beginAttempt,settleAttempt,withAttemptLock,isConfirmedSale,isDefiniteWriteRejection} from '../../utils/checkoutAttempt';
import {reconcilePersistedCart,cartReconciliationMessage} from '../../utils/posCartReconciliation';
import {allocateTrackedStock} from '../../utils/stockTracking';
import {cartTotals,effectiveDiscount,finalUnitPrice,allowedCartDiscount,paymentPlan,addCartProduct,validateQuantity} from './model';

export default function useProSession({user,store,catalog,canDiscount,discountLimit,creditAllowed}){
 const {currentStoreId:storeId,activeShift,commitSaleTransaction,createSaleHold,deleteSaleHold,loadSaleHolds,reloadStore}=store;
 const key=`${posDraftKey(user.organizationId,user.id,storeId)}:pro`,journal=attemptKey(user.organizationId,storeId,user.id,'sale'),holdJournal=attemptKey(user.organizationId,storeId,user.id,'pos-pro-hold');
 const [initial]=useState(()=>readPosDraft(localStorage,key));
 const [cart,setCart]=useState(initial?.cart||[]),[cartPct,setCartPct]=useState(Number(initial?.cartDiscountPct||0));
 const [customerId,setCustomerId]=useState(initial?.customerId||''),[customer,setCustomer]=useState(initial?.customer||'');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[receipt,setReceipt]=useState(null);
 const [recovery,setRecovery]=useState(()=>readAttempt(localStorage,journal)),[holdRecovery,setHoldRecovery]=useState(()=>readAttempt(localStorage,holdJournal));
 const [held,setHeld]=useState([]);
 const active=useRef(true),busyRef=useRef(false),reference=useRef(initial?.checkoutReference||`PRO-${crypto.randomUUID()}`),current=useRef(null);
 current.current={cart,cartPct,customerId,customer};
 const reconcile=(lines,products,pct=cartPct)=>{
  const result=reconcilePersistedCart({lines,products,storeId,discountAllowed:canDiscount,discountLimit});
  const restoredPct=allowedCartDiscount(result.lines,pct,canDiscount,discountLimit);
  if(restoredPct!==Number(pct))result.changes.push({type:'discount_changed',name:'Savat',previousDiscount:pct,currentDiscount:restoredPct});
  return {...result,cartPct:restoredPct};
 };
 const restore=async()=>{
  try{const resolved=await catalog.resolve((initial?.cart||[]).map(p=>p.id));if(!active.current)return;
   const result=reconcile(initial?.cart||[],resolved.products);setCart(result.lines);setCartPct(result.cartPct);setNotice(cartReconciliationMessage(result.changes));setReady(true);
  }catch{if(active.current){setNotice('Offline draft saqlangan. Savdo oldidan narx va qoldiq serverdan tekshiriladi.');setReady(true)}}
 };
 useEffect(()=>{active.current=true;void restore();return()=>{active.current=false}},[]);
 useEffect(()=>{catalog.pin(cart.map(p=>p.id))},[cart,catalog.pin]);
 useEffect(()=>{
  if(!ready||recovery||holdRecovery)return;
  if(!cart.length){clearPosDraft(localStorage,key);return}
  if(!savePosDraft(localStorage,key,{cart,cartDiscountPct:cartPct,customerId,customer,checkoutReference:reference.current}))setError('Draft saqlanmadi. Qurilma xotirasini tekshiring.');
 },[cart,cartPct,customerId,customer,ready,recovery,holdRecovery,key]);
 useEffect(()=>{const sync=event=>{if(event.key===journal||event.key===null){const packet=readAttempt(localStorage,journal);setRecovery(packet);if(!packet)setNotice('Boshqa oynadagi savdo holati yangilandi. Joriy draft savdo oldidan qayta tekshiriladi.')}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[journal]);
 const previousShift=useRef(activeShift?.id);
 useEffect(()=>{const id=activeShift?.id;if(previousShift.current===id)return;previousShift.current=id;if(!id||!ready||busyRef.current||recovery||holdRecovery||!current.current.cart.length)return;busyRef.current=true;setBusy(true);const intent=current.current;catalog.resolve(intent.cart.map(p=>p.id)).then(resolved=>{if(!active.current)return;const result=reconcile(intent.cart,resolved.products,intent.cartPct);setCart(result.lines);setCartPct(result.cartPct);setNotice(cartReconciliationMessage(result.changes)||'Smena uchun draft narxi va qoldig‘i qayta tekshirildi.')}).catch(e=>{if(active.current)setError(e.message)}).finally(()=>{busyRef.current=false;if(active.current)setBusy(false)})},[activeShift?.id,ready,recovery,holdRecovery]);
 const locked=busy||Boolean(recovery)||Boolean(holdRecovery)||!ready;
 const add=(p,q=1)=>{if(locked)return;setError('');setCart(items=>{try{return addCartProduct(items,p,q)}catch(e){queueMicrotask(()=>active.current&&setError(e.message));return items}})};
 const quantity=(id,value)=>{if(locked)return;try{const q=validateQuantity(value);const line=cart.find(p=>p.id===id);if(q>Number(line.quantity))throw Error('Qoldiq yetarli emas');setCart(items=>items.map(p=>p.id===id?{...p,cartQty:q}:p))}catch(e){setError(e.message)}};
 const discount=(id,value)=>{
  if(locked||!canDiscount)return;const n=Number(value);if(!Number.isFinite(n)||n<0||n>discountLimit){setError(`Chegirma limiti: ${discountLimit}%. Manager mavjud ruxsat bilan kirishi kerak.`);return}
  const next=id?cart.map(p=>p.id===id?{...p,discountPercent:n}:p):cart;
  if(next.some(p=>effectiveDiscount(p.discountPercent,id?cartPct:n)>discountLimit+0.00001)){setError(`Birgalikdagi chegirma ${discountLimit}% dan oshdi`);return}
  if(id)setCart(next);else setCartPct(n);
 };
 const reset=()=>{setCart([]);setCartPct(0);setCustomer('');setCustomerId('');setNotice('');reference.current=`PRO-${crypto.randomUUID()}`;clearPosDraft(localStorage,key)};
 const finish=(sale,packet)=>{
  // Persist confirmation first; a page crash before local cleanup remains a safe replay.
  const originalKey=packet?.payload?.source==='pos-pro'?key:posDraftKey(user.organizationId,user.id,storeId);
  clearPosDraft(localStorage,originalKey);settleAttempt(localStorage,journal,'confirmed');
  if(!active.current)return;
  setRecovery(null);setReceipt(sale);if(originalKey===key)reset();void reloadStore({silent:true});
 };
 const recover=async(retry=false)=>{
  if(busyRef.current||!navigator.onLine)return;busyRef.current=true;setBusy(true);setError('');
  try{await withAttemptLock(journal,async()=>{
   const packet=readAttempt(localStorage,journal);if(!packet){if(active.current)setRecovery(null);return}
   const found=await api.get(`/api/sales/reconciliation?${new URLSearchParams({storeId,clientReference:packet.clientReference})}`);
   if(found.state==='confirmed'&&isConfirmedSale(found.sale)){finish({...packet.payload,id:found.sale.id,saleNumber:found.sale.sale_number,createdAt:found.sale.created_at},packet);return}
   if(retry){const result=await commitSaleTransaction({sale:packet.payload,storeId,lockHeld:true});if(result.success){finish(result.sale,packet);return}}
   if(active.current)setError('Savdo natijasi noma’lum. Yangi chek ochmang; shu savdoni qayta tekshiring.');
  })}catch(e){if(active.current)setError(e.message||'Aloqa yo‘q. Aynan shu savdoni qayta tekshiring.')}
  finally{busyRef.current=false;if(active.current){setBusy(false);setRecovery(readAttempt(localStorage,journal))}}
 };
 const checkout=async(payment)=>{
  if(busyRef.current||locked)return false;
  if(!navigator.onLine){setError('Internet yo‘q: faqat draft rejimi. Savdo serverga yozilmadi.');return false}
  if(!activeShift){setError('Avval joriy filialda smena oching');return false}
  if(!cart.length)return false;
  busyRef.current=true;setBusy(true);setError('');
  try{
   if(readAttempt(localStorage,journal)){setRecovery(readAttempt(localStorage,journal));return false}
   const resolved=await catalog.resolve(cart.map(p=>p.id));if(!active.current)return false;
   const checked=reconcile(cart,resolved.products);
   if(checked.changes.length||checked.hasBlockingStockIssue){setCart(checked.lines);setCartPct(checked.cartPct);setNotice(cartReconciliationMessage(checked.changes));setError('Savat yangilandi. Tekshirib, to‘lovni qayta oching.');return false}
   if(checked.lines.some(p=>effectiveDiscount(p.discountPercent,cartPct)>discountLimit+0.00001||!canDiscount&&(p.discountPercent>0||cartPct>0)))throw Error('Chegirmani mavjud ruxsat va limitga moslang');
   const totals=cartTotals(checked.lines,cartPct),plan=paymentPlan({...payment,total:totals.total,customerId,creditAllowed});
   const saleId=reference.current;
   const items=checked.lines.map(p=>{
    validateSerialChoice(p,storeId);
    const tracking=allocateTrackedStock(p,storeId,p.cartQty,{saleId,soldAt:new Date().toISOString(),selection:p.tracking});
    if(!tracking.success)throw Error(tracking.message);
    return {...p,quantity:p.cartQty,finalPrice:finalUnitPrice(p,cartPct),cartDiscountPercent:cartPct,tracking:tracking.tracking};
   });
   const sale={id:saleId,source:'pos-pro',storeId,store:store.currentStore?.name,shiftId:activeShift.id,sellerName:user.name,createdAt:new Date().toISOString(),items,total:totals.total,subtotal:totals.subtotal,discountTotal:totals.discount,cartDiscountPercent:cartPct,paymentMethod:payment.method,paymentBreakdown:plan.breakdown,creditAmount:plan.credit,creditDueDate:payment.dueDate||null,cashTendered:plan.tendered,change:plan.change,customer,customerId:customerId||null,externalPaymentConfirmation:payment.externalConfirmed?'manual-confirmed':null};
   if(!savePosDraft(localStorage,key,{...current.current,cartDiscountPct:cartPct,checkoutReference:saleId}))throw Error('Savdo oldidan draft saqlanmadi');
   const result=await commitSaleTransaction({sale,storeId});
   if(result.success){await withAttemptLock(journal,()=>{const packet=readAttempt(localStorage,journal);if(packet?.clientReference===saleId)finish(result.sale,packet);else if(active.current){reset();setReceipt(result.sale)}});return true}
   if(active.current){setRecovery(readAttempt(localStorage,journal));setError(result.message||'Savdo bajarilmadi')}
   return false;
  }catch(e){if(active.current)setError(e.message);return false}
  finally{busyRef.current=false;if(active.current)setBusy(false)}
 };
 const loadHolds=async()=>{const result=await loadSaleHolds(storeId);if(!active.current)return;if(result.success)setHeld(result.holds);else setError(result.message)};
 const hold=async()=>{
  if(busyRef.current||recovery||!ready||!cart.length&&!holdRecovery)return false;busyRef.current=true;setBusy(true);setError('');
  try{
   const saved=readAttempt(localStorage,holdJournal);
   const payload=saved?.payload||{name:`POS Pro ${new Date().toLocaleTimeString()}`,cart:persistedCartIntent(cart),customerId,customer,cartDiscountPct:cartPct,storeId,shiftId:activeShift?.id||null,clientReference:reference.current};
   const packet=beginAttempt(localStorage,holdJournal,{clientReference:payload.clientReference,payload});
   const result=await createSaleHold(packet.payload);if(!result.success){
    // A first, definite rejection made no hold. Uncertain earlier dispatches keep
    // their exact packet until the server can confirm them.
    if(!saved&&isDefiniteWriteRejection(result))settleAttempt(localStorage,holdJournal,'rejected');
    if(active.current){setHoldRecovery(readAttempt(localStorage,holdJournal));setError(result.message)}return false;
   }
   settleAttempt(localStorage,holdJournal,'confirmed');clearPosDraft(localStorage,key);
   if(active.current){setHoldRecovery(null);reset();setHeld(rows=>[result.hold,...rows.filter(p=>p.id!==result.hold.id)])}return true;
  }catch(e){if(active.current){setHoldRecovery(readAttempt(localStorage,holdJournal));setError(e.message)}return false}
  finally{busyRef.current=false;if(active.current)setBusy(false)}
 };
 const resume=async(h)=>{
  if(locked||busyRef.current||cart.length){setError('Avval joriy chekni yakunlang yoki Hold qiling');return false}
  busyRef.current=true;setBusy(true);
  try{
   const {products}=await catalog.resolve(h.cart.map(p=>p.id));if(!active.current)return false;
   const checked=reconcile(h.cart,products,h.cartDiscountPct||0),saved={...h,cart:checked.lines,cartDiscountPct:checked.cartPct,checkoutReference:h.clientReference||`PRO-HOLD-${h.id}`};
   if(!savePosDraft(localStorage,key,saved))throw Error('Hold tiklash zaxirasi saqlanmadi');
   const result=await deleteSaleHold(h.id);if(!active.current)return false;
   if(!result.success){
    // DELETE may have committed before a timeout. Keep the durable restored intent;
    // the same hold reference still deduplicates any later checkout.
    if(result.status>=400&&result.status<500&&result.status!==408&&result.status!==404){clearPosDraft(localStorage,key);throw Error(result.message)}
    setNotice('Hold o‘chirish javobi tasdiqlanmadi. Chek draftdan tiklandi; qayta savdo ayni identifikator bilan himoyalangan.');
   }
   reference.current=saved.checkoutReference;setCart(checked.lines);setCustomer(h.customer||'');setCustomerId(h.customerId||'');setCartPct(checked.cartPct);setNotice(current=>[current,cartReconciliationMessage(checked.changes)].filter(Boolean).join(' '));setHeld(rows=>rows.filter(p=>p.id!==h.id));return true;
  }catch(e){if(active.current)setError(e.message);return false}
  finally{busyRef.current=false;if(active.current)setBusy(false)}
 };
 return {cart,cartPct,customer,customerId,setCustomer,setCustomerId,error,setError,notice,setNotice,busy,ready,locked,receipt,setReceipt,recovery,holdRecovery,held,add,quantity,discount,tracking:(id,selection)=>{if(!locked)setCart(rows=>rows.map(p=>p.id===id?{...p,tracking:selection}:p))},remove:id=>!locked&&setCart(rows=>rows.filter(p=>p.id!==id)),reset,checkout,recover,hold,resume,loadHolds};
}
