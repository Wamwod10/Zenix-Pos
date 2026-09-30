import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiClock, FiCreditCard, FiDollarSign, FiMinus, FiPackage, FiPause, FiPercent,
  FiPlus, FiPrinter, FiRefreshCw, FiSearch, FiShoppingBag, FiShoppingCart,
  FiTrash2, FiUser, FiLayers, FiCamera,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { ROLES } from "../../config/roles";
import { formatPrice } from "../../utils/formatPrice";
import { StatusBadge, PremiumSelect } from "../../components/Ui";
import { workspaceDateISO, workspaceBusinessDateISO, formatWorkspaceDate, workspaceTime } from "../../utils/workspaceDate";
import { saleNetPaymentBreakdown, saleNetRevenue } from "../../utils/reporting";
import { applyReturnToSale, getRefundAllocation, getRefundCashAdjustment, RETURN_REASONS } from "../../utils/returns";
import { allocateTrackedStock, restoreTrackedStock } from "../../utils/stockTracking";
import Modal from "../../components/Modal";
import BarcodeScannerModal from "../../components/BarcodeScannerModal";
import { useFeedback } from "../../context/FeedbackContext";
import "./sales.scss";

const payLabels = { cash:"Naqd", card:"Karta", transfer:"O‘tkazma", split:"Aralash" };
function Sales(){
  const {currentUser}=useAuth();
  const {undo,confirm}=useFeedback();
  const {
    inventory,dailySales,salesHistory,returns,
    activeShift,effectiveWorkspaceSettings:workspaceSettings,addActivityLog,currentStore,currentStoreId,getStoreStock,getStoreProduct,loadSaleHolds,createSaleHold,deleteSaleHold,commitSaleTransaction,commitReturnTransaction,commitBusinessDay,hasPermission,
  }=useStore();
  const [search,setSearch]=useState("");
  const [mobilePane,setMobilePane]=useState("catalog");
  const [category,setCategory]=useState("all");
  const [cart,setCart]=useState([]);
  const [payment,setPayment]=useState(workspaceSettings.pos.defaultPayment||"cash");
  const [cashTendered,setCashTendered]=useState("");
  const [splitCard,setSplitCard]=useState("");
  const [splitTransfer,setSplitTransfer]=useState("");
  const [splitCashTendered,setSplitCashTendered]=useState("");
  const [customer,setCustomer]=useState("");
  const [note,setNote]=useState("");
  const [held,setHeld]=useState([]);
  const [heldModal,setHeldModal]=useState(false);
  const [holdToolsOpen,setHoldToolsOpen]=useState(false);
  const [todaySalesOpen,setTodaySalesOpen]=useState(false);
  const [scannerOpen,setScannerOpen]=useState(false);
  const [closeDayModal,setCloseDayModal]=useState(false);
  const [holdName,setHoldName]=useState("");
  const [receipt,setReceipt]=useState(null);
  const [processing,setProcessing]=useState(false);
  const [returnProcessing,setReturnProcessing]=useState(false);
  const [productLimit,setProductLimit]=useState(40);
  const [todaySalesLimit,setTodaySalesLimit]=useState(30);
  const [saleConfirmOpen,setSaleConfirmOpen]=useState(false);
  const [error,setError]=useState("");
  const [discountItem,setDiscountItem]=useState(null);
  const [discount,setDiscount]=useState("");
  const [cartDiscountModal,setCartDiscountModal]=useState(false);
  const [cartDiscountInput,setCartDiscountInput]=useState("0");
  const [cartDiscountPct,setCartDiscountPct]=useState(0);
  const [returnSale,setReturnSale]=useState(null);
  const [returnItem,setReturnItem]=useState(null);
  const [returnQty,setReturnQty]=useState(1);
  const [returnReason,setReturnReason]=useState("");
  const [refundMethod,setRefundMethod]=useState("original");
  const [returnError,setReturnError]=useState("");
  const [businessTick,setBusinessTick]=useState(Date.now());
  const searchRef=useRef(null);
  const checkoutRef=useRef(null);
  const scannerBufferRef=useRef("");
  const scannerLastKeyRef=useRef(0);
  const scannerResetRef=useRef(null);
  const holdCartActionRef=useRef(null);
  const holdCartEnabledRef=useRef(false);

  useEffect(()=>{
    let active=true;
    if(!currentStoreId){setHeld([]);return()=>{active=false}}
    void loadSaleHolds(currentStoreId).then((result)=>{if(active&&result?.success)setHeld(result.holds||[])});
    return()=>{active=false};
  },[currentStoreId,currentUser?.id,loadSaleHolds]);


  const paymentMethods={cash:true,card:true,transfer:true,split:true,...(workspaceSettings.pos.paymentMethods||{})};
  const enabledPaymentTypes=["cash","card","transfer","split"].filter(type=>paymentMethods[type]!==false);
  useEffect(()=>{
    if(!enabledPaymentTypes.includes(payment))setPayment(enabledPaymentTypes[0]||"cash");
  },[payment,enabledPaymentTypes.join("|")]);
  useEffect(()=>{
    if(!activeShift)return undefined;
    setBusinessTick(Date.now());
    const timer=setInterval(()=>setBusinessTick(Date.now()),30000);
    return()=>clearInterval(timer);
  },[activeShift?.id]);

  const categories=[...new Set(inventory.filter(p=>!p.archived).map(p=>p.category).filter(Boolean))];
  const filteredProducts=useMemo(()=>inventory.filter(p=>!p.archived&&(category==="all"||p.category===category)&&`${p.name} ${p.sku||""} ${p.barcode||""}`.toLowerCase().includes(search.toLowerCase())),[inventory,category,search]);
  const products=useMemo(()=>filteredProducts.slice(0,productLimit),[filteredProducts,productLimit]);
  useEffect(()=>setProductLimit(40),[category,search]);
  const topProducts=useMemo(()=>inventory.filter(p=>!p.archived&&p.quantity>0).slice(0,5),[inventory]);
  const canDiscount=currentUser?.appRole!==ROLES.CASHIER||Boolean(workspaceSettings.pos.cashierDiscountAllowed);
  const canReturn=hasPermission("returns",currentUser?.appRole);
  const canCloseBusinessDay=hasPermission("closeBusinessDay",currentUser?.appRole);
  const blockNegative=workspaceSettings.pos.blockNegativeStock!==false;
  const organizationSettings=workspaceSettings.organization||{};
  const businessDay=workspaceSettings.businessDay||{};
  const maxShiftHours=Math.max(1,Number(businessDay.maxShiftHours||12));
  const activeShiftDuration=activeShift?.openedAtISO?Math.max(0,businessTick-new Date(activeShift.openedAtISO).getTime()):0;
  const longShift=Boolean(activeShift&&activeShiftDuration>=maxShiftHours*3600000);
  const businessClose=businessDay.closeTime||"23:59";
  const warnBeforeClose=Math.max(0,Number(businessDay.warnBeforeCloseMinutes||0));
  const toClockMinutes=(value)=>{const [hours,minutes]=String(value||"00:00").split(":").map(Number);return Math.max(0,Math.min(1439,(hours||0)*60+(minutes||0)))};
  const localClock=workspaceTime(new Date(businessTick),organizationSettings).slice(0,5);
  const minutesUntilClose=(toClockMinutes(businessClose)-toClockMinutes(localClock)+1440)%1440;
  const closeWarning=Boolean(activeShift&&warnBeforeClose>0&&minutesUntilClose<=warnBeforeClose);
  const receiptCopies=Math.max(1,Math.min(3,Number(workspaceSettings.receipt?.copies||1)));
  const discountLimit=Math.max(0,Number(workspaceSettings.pos.discountLimit||0));
  const formatInputMoney=(value)=>value===""?"":new Intl.NumberFormat("uz-UZ",{maximumFractionDigits:0}).format(Math.max(0,Number(value||0)));
  const moneyDigits=(value)=>String(value||"").replace(/[^0-9]/g,"");
  const effectiveDiscount=(itemPct,cartPct)=>100-(100-Number(itemPct||0))*(100-Number(cartPct||0))/100;
  const maxCartDiscountAllowed=cart.length?Math.max(0,Math.min(discountLimit,...cart.map(item=>{const itemPct=Math.max(0,Number(item.discountPercent||0));if(itemPct>=100)return 0;return Math.max(0,((discountLimit-itemPct)/(100-itemPct))*100)}))):discountLimit;
  const maxItemDiscountAllowed=cartDiscountPct>=100?0:Math.max(0,((discountLimit-cartDiscountPct)/(100-cartDiscountPct))*100);
  const getBaseUnitPrice=(item)=>Math.max(0,Number(item.sellPrice||item.price||0));
  const getItemUnitPrice=(item)=>getBaseUnitPrice(item)*(1-Number(item.discountPercent||0)/100);
  const getFinalUnitPrice=(item)=>getItemUnitPrice(item)*(1-cartDiscountPct/100);
  const subtotal=cart.reduce((sum,item)=>sum+getBaseUnitPrice(item)*item.cartQty,0);
  const afterItemDiscount=cart.reduce((sum,item)=>sum+getItemUnitPrice(item)*item.cartQty,0);
  const itemDiscountTotal=subtotal-afterItemDiscount;
  const cartDiscountAmount=afterItemDiscount*(cartDiscountPct/100);
  const total=Math.max(0,afterItemDiscount-cartDiscountAmount);
  const discountTotal=itemDiscountTotal+cartDiscountAmount;
  const change=Math.max(0,Number(cashTendered||0)-total);
  const splitCardN=Math.max(0,Number(splitCard||0));
  const splitTransferN=Math.max(0,Number(splitTransfer||0));
  const splitCash=Math.max(0,total-splitCardN-splitTransferN);
  const splitCashTenderedN=Math.max(0,Number(splitCashTendered||0));
  const splitChange=Math.max(0,splitCashTenderedN-splitCash);
  const splitMethodCount=[splitCash,splitCardN,splitTransferN].filter(value=>value>0.009).length;
  const splitValid=splitCardN+splitTransferN<=total&&splitMethodCount>=2&&(splitCash<=0||splitCashTenderedN>=splitCash);
  const storeDailySales=useMemo(()=>dailySales.filter(sale=>sale.storeId?String(sale.storeId)===String(currentStoreId):sale.store===currentStore?.name),[dailySales,currentStoreId,currentStore?.name]);

  const add=(product)=>{
    setError("");
    if(blockNegative&&Number(product.quantity)<=0){setError(`${product.name} omborda tugagan`);return}
    setCart(items=>{
      const existing=items.find(item=>item.id===product.id);
      if(existing){
        if(blockNegative&&existing.cartQty>=product.quantity){setError(`Omborda faqat ${product.quantity} ${product.unit||"dona"} bor`);return items}
        return items.map(item=>item.id===product.id?{...item,cartQty:item.cartQty+1}:item);
      }
      return [...items,{...product,cartQty:1,discountPercent:0}];
    });
  };
  const qty=(id,next)=>{
    const product=inventory.find(item=>item.id===id);
    const value=Math.max(0,blockNegative?Math.min(Number(next||0),Number(product?.quantity||0)):Number(next||0));
    setCart(items=>items.map(item=>item.id===id?{...item,cartQty:value}:item).filter(item=>item.cartQty>0));
  };
  useEffect(()=>{
    const onScannerKey=(event)=>{
      const target=event.target;
      const tag=target?.tagName?.toLowerCase();
      const editable=tag==="input"||tag==="textarea"||tag==="select"||target?.isContentEditable;
      if(editable)return;
      const now=performance.now();
      if(event.key==="Enter"){
        const code=scannerBufferRef.current.trim();
        scannerBufferRef.current="";
        if(scannerResetRef.current)window.clearTimeout(scannerResetRef.current);
        if(code.length<4)return;
        const exact=inventory.find(item=>!item.archived&&String(item.barcode||"").trim()===code);
        if(exact&&workspaceSettings.pos.barcodeAutoAdd!==false){event.preventDefault();add(exact);setSearch("");return}
        setSearch(code);
        requestAnimationFrame(()=>searchRef.current?.focus());
        return;
      }
      if(event.key.length!==1||event.ctrlKey||event.metaKey||event.altKey)return;
      if(now-scannerLastKeyRef.current>110)scannerBufferRef.current="";
      scannerLastKeyRef.current=now;
      scannerBufferRef.current+=event.key;
      if(scannerResetRef.current)window.clearTimeout(scannerResetRef.current);
      scannerResetRef.current=window.setTimeout(()=>{scannerBufferRef.current=""},180);
    };
    window.addEventListener("keydown",onScannerKey);
    return()=>{window.removeEventListener("keydown",onScannerKey);if(scannerResetRef.current)window.clearTimeout(scannerResetRef.current)};
  },[inventory,workspaceSettings.pos.barcodeAutoAdd,blockNegative,currentStoreId]);
  const handleSearchKey=(event)=>{
    if(event.key!=="Enter")return;
    const exact=inventory.find(item=>!item.archived&&String(item.barcode||"").trim()===search.trim());
    if(!exact&&!workspaceSettings.pos.enterAddsProduct)return;
    if(exact&&!workspaceSettings.pos.barcodeAutoAdd&&!workspaceSettings.pos.enterAddsProduct)return;
    const target=exact||products[0];
    if(!target)return;
    event.preventDefault();add(target);setSearch("");
  };
  const applyDiscount=()=>{
    if(!canDiscount){setDiscountItem(null);return}
    const value=Math.max(0,Math.min(Number(discount||0),maxItemDiscountAllowed));
    setCart(items=>items.map(item=>item.id===discountItem?.id?{...item,discountPercent:value}:item));
    setDiscountItem(null);setDiscount("");
  };
  const applyCartDiscount=()=>{
    if(!canDiscount){setCartDiscountModal(false);return}
    const value=Math.max(0,Math.min(Number(cartDiscountInput||0),maxCartDiscountAllowed));
    setCartDiscountPct(value);setCartDiscountInput(String(value));setCartDiscountModal(false);
  };
  const holdCart=async()=>{
    if(!workspaceSettings.pos.holdCartEnabled||!cart.length)return;
    const name=holdName.trim()||`Savat ${held.length+1}`;
    const result=await createSaleHold({name,cart,total,customer,note,cartDiscountPct,storeId:currentStoreId,shiftId:activeShift?.id||null});
    if(!result?.success){setError(result?.message||"Savatni ushlab turib bo‘lmadi");return}
    setHeld(items=>[result.hold,...items.filter(item=>item.id!==result.hold.id)]);
    setCart([]);setCustomer("");setNote("");setHoldName("");setCartDiscountPct(0);setCartDiscountInput("0");setHoldToolsOpen(false);
  };
  holdCartActionRef.current=holdCart;
  holdCartEnabledRef.current=Boolean(workspaceSettings.pos.holdCartEnabled);
  const restoreHold=async(heldCart)=>{
    const result=await deleteSaleHold(heldCart.id);
    if(!result?.success){setError(result?.message||"Savatni davom ettirib bo‘lmadi");return}
    setCart(heldCart.cart);setCustomer(heldCart.customer||"");setNote(heldCart.note||"");
    setCartDiscountPct(Number(heldCart.cartDiscountPct||0));setCartDiscountInput(String(heldCart.cartDiscountPct||0));
    setHeld(items=>items.filter(item=>item.id!==heldCart.id));setHeldModal(false);
  };
  const clearCart=()=>{if(!cart.length)return;const previous={cart:[...cart],cartDiscountPct};setCart([]);setCartDiscountPct(0);setCartDiscountInput("0");undo({title:"Savat tozalandi",message:`${previous.cart.reduce((sum,item)=>sum+Number(item.cartQty||0),0)} dona`,onUndo:()=>{setCart(previous.cart);setCartDiscountPct(previous.cartDiscountPct);setCartDiscountInput(String(previous.cartDiscountPct||0))}})};
  const requestDeleteHold=async(item)=>{
    if(!item)return;
    const accepted=await confirm({title:"Savatni o‘chirish",message:`${item.name} savati ushlab turilgan ro‘yxatdan o‘chiriladi.`,confirmLabel:"O‘chirish",cancelLabel:"Bekor qilish",tone:"danger"});if(!accepted)return;
    const result=await deleteSaleHold(item.id);if(!result?.success){setError(result?.message||"Savatni o‘chirib bo‘lmadi");return}
    setHeld(items=>items.filter(row=>row.id!==item.id));
    undo({title:"Savat o‘chirildi",message:item.name,onUndo:async()=>{const restored=await createSaleHold({name:item.name,cart:item.cart,total:item.total,customer:item.customer,note:item.note,cartDiscountPct:item.cartDiscountPct,storeId:currentStoreId,shiftId:item.shiftId||activeShift?.id||null});if(restored?.success)setHeld(items=>[restored.hold,...items.filter(row=>row.id!==restored.hold.id)])}});
  };
  const completeSale=async()=>{
    if(processing)return;
    if(!activeShift){setError("Savdo qilish uchun avval smenani oching");return}
    if(!cart.length)return;
    const stale=blockNegative?cart.find(item=>getStoreStock(item.id,currentStoreId)<Number(item.cartQty||0)):null;
    if(stale){setError(`${stale.name}: joriy filial qoldig‘i o‘zgargan. Savat miqdorini yangilang.`);return}
    if(!["cash","card","transfer","split"].includes(payment)){setError("Noto‘g‘ri to‘lov turi");return}
    if(payment==="cash"&&Number(cashTendered||0)<total){setError("Mijoz bergan summa yetarli emas");return}
    if(payment==="split"&&!splitValid){setError(splitMethodCount<2?"Aralash to‘lovda kamida 2 ta to‘lov usulidan foydalaning":splitCardN+splitTransferN>total?"Karta va o‘tkazma summasi jami summadan oshmasligi kerak":"Mijoz bergan naqd summa naqd qismidan kam");return}
    const saleId=`S-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const soldAt=new Date().toISOString();
    const trackedUpdates=[];
    const trackingByProduct=new Map();
    for(const line of cart){
      const product=inventory.find((item)=>item.id===line.id);
      if(!product){setError(`${line.name}: mahsulot topilmadi`);return}
      const planned=allocateTrackedStock(product,currentStoreId,Number(line.cartQty||0),{saleId,soldAt});
      if(!planned.success){setError(planned.message||`${line.name}: qoldiqni yangilab bo‘lmadi`);return}
      trackedUpdates.push(planned.product);
      trackingByProduct.set(line.id,planned.tracking);
    }
    setProcessing(true);setError("");
    const saleItems=cart.map(item=>({...item,quantity:item.cartQty,qty:item.cartQty,finalPrice:getFinalUnitPrice(item),returnedQty:0,cartDiscountPercent:cartDiscountPct,tracking:trackingByProduct.get(item.id)||null}));
    const saleMoment=new Date();
    const sale={
      id:saleId,dateISO:workspaceDateISO(saleMoment,organizationSettings.timezone),businessDateISO:workspaceBusinessDateISO(saleMoment,organizationSettings,businessDay),date:formatWorkspaceDate(saleMoment,organizationSettings),
      time:workspaceTime(saleMoment,organizationSettings),sellerId:currentUser?.employeeId||currentUser?.id,sellerAccountId:currentUser?.id,sellerName:currentUser?.name,seller:currentUser?.name,
      storeId:currentStoreId,store:currentStore?.name,shiftId:activeShift?.id,paymentMethod:payment,saleTotal:total,total,subtotal,discountTotal,cartDiscountPercent:cartDiscountPct,
      cashTendered:payment==="split"?splitCashTenderedN:Number(cashTendered||0),change:payment==="split"?splitChange:change,paymentBreakdown:payment==="split"?{cash:splitCash,card:splitCardN,transfer:splitTransferN}:null,
      customer,note,items:saleItems,
    };
    const committed=await commitSaleTransaction({
      sale,storeId:currentStoreId,productUpdates:trackedUpdates,
      activity:{type:"sale",title:"Savdo amalga oshirildi",description:`${formatPrice(total)} · ${payLabels[payment]}`}
    });
    if(!committed.success){setProcessing(false);setError(committed.message||"Savdoni saqlab bo‘lmadi");return}
    setReceipt(committed.sale||sale);setCart([]);setCashTendered("");setSplitCard("");setSplitTransfer("");setSplitCashTendered("");setCustomer("");setNote("");setCartDiscountPct(0);setCartDiscountInput("0");setMobilePane("catalog");setProcessing(false);
    if(workspaceSettings.pos.autoPrintReceipt)setTimeout(()=>window.print(),80);
  };
  const closeBusinessDay=async()=>{
    if(!storeDailySales.length||activeShift)return;
    const totals=storeDailySales.reduce((result,sale)=>{const part=saleNetPaymentBreakdown(sale);result.cash+=part.cash;result.card+=part.card;result.transfer+=part.transfer;return result},{cash:0,card:0,transfer:0});
    const dayMoment=new Date();
    const day={id:`DAY-${crypto.randomUUID().slice(0,8).toUpperCase()}`,storeId:currentStoreId,store:currentStore?.name,dateISO:workspaceDateISO(dayMoment,organizationSettings.timezone),businessDateISO:workspaceBusinessDateISO(dayMoment,organizationSettings,businessDay),date:formatWorkspaceDate(dayMoment,organizationSettings),total:storeDailySales.reduce((sum,sale)=>sum+saleNetRevenue(sale),0),cash:totals.cash,card:totals.card,transfer:totals.transfer,count:storeDailySales.length,sales:[...storeDailySales]};
    const committed=await commitBusinessDay({day,storeId:currentStoreId,storeName:currentStore?.name,activity:{type:"sale",title:"Kunlik savdo yakunlandi",description:`${day.count} ta tranzaksiya · ${formatPrice(day.total)}`}});
    if(!committed?.success){setError(committed?.message||"Biznes kunini yakunlab bo‘lmadi");return}
    setCloseDayModal(false);
  };
  const performReturn=async()=>{
    if(returnProcessing)return;
    setReturnError("");
    if(!canReturn||!returnSale||!returnItem||returnQty<=0||!returnReason)return;
    const productId=returnItem.productId||returnItem.id;
    const result=applyReturnToSale(returnSale,productId,returnQty);
    if(!result.quantity)return;
    const allocation=getRefundAllocation(returnSale,result.amount,refundMethod);
    const cashAdjustment=getRefundCashAdjustment(returnSale,result.amount,refundMethod,activeShift?.id);
    if(cashAdjustment&&!activeShift){setReturnError("Naqd pul harakati talab qilinadi. Avval smenani oching.");return}
    const returnStoreId=returnSale.storeId||currentStoreId;
    if(String(returnStoreId)!==String(currentStoreId)){setReturnError("Qaytarish savdo amalga oshirilgan filialda bajarilishi kerak. Avval o‘sha filialga o‘ting.");return}
    const product=getStoreProduct(productId,returnStoreId);
    if(!product){setReturnError("Mahsulot katalogda topilmadi. Qoldiqni tiklamasdan qaytarish bajarilmaydi.");return}
    let productUpdates=[];
    const returnId=`RET-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const restored=restoreTrackedStock(product,returnStoreId,result.quantity,returnItem.tracking,Number(returnItem.returnedQty||0),{saleId:returnSale.id,returnId});
    if(!restored.success){setReturnError(restored.message||"Qoldiqni qaytarib bo‘lmadi.");return}
    productUpdates=[restored.product];
    const now=new Date();
    const returnRecord={id:returnId,saleId:returnSale.id,storeId:returnSale.storeId||currentStoreId,shiftId:returnSale.shiftId||"",refundShiftId:activeShift?.id||"",productId,productName:returnItem.name,quantity:result.quantity,amount:result.amount,reason:returnReason,refundMethod,refundBreakdown:allocation,dateISO:workspaceDateISO(now,organizationSettings.timezone),businessDateISO:workspaceBusinessDateISO(now,organizationSettings,businessDay),date:formatWorkspaceDate(now,organizationSettings),time:workspaceTime(now,organizationSettings)};
    const cashMovement=cashAdjustment&&activeShift?{id:crypto.randomUUID(),type:cashAdjustment.type,amount:cashAdjustment.amount,reason:`Qaytarish: ${returnSale.id}`,time:workspaceTime(now,organizationSettings),source:"return-adjustment",saleId:returnSale.id}:null;
    setReturnProcessing(true);
    const committed=await commitReturnTransaction({saleId:returnSale.id,updatedSale:result.sale,productUpdates,stockStoreId:returnStoreId,returnRecord,cashMovement,activity:{type:"return",title:"Qaytarish qilindi",description:`${returnItem.name} · ${result.quantity} dona · ${formatPrice(result.amount)}`}});
    setReturnProcessing(false);
    if(!committed.success){setReturnError(committed.message||"Qaytarishni saqlab bo‘lmadi.");return}
    setReturnSale(null);setReturnItem(null);setReturnReason("");setReturnQty(1);setRefundMethod("original");setReturnError("");
  };

  useEffect(()=>{
    const handler=(event)=>{
      const target=event.target;
      const isTyping=target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
      if(isTyping)return;
      if(event.key==="F2"){event.preventDefault();searchRef.current?.focus()}
      if(event.key==="F4"){event.preventDefault();checkoutRef.current?.focus()}
      if(event.key==="F6"&&holdCartEnabledRef.current){event.preventDefault();holdCartActionRef.current?.()}
      if(event.key==="Escape"){setHeldModal(false);setTodaySalesOpen(false);setDiscountItem(null);setCartDiscountModal(false);setSaleConfirmOpen(false);setReturnSale(null);setReturnError("")}
    };
    window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);
  },[]);

  return <div className="pos-page-pro">
    <div className="pos-topbar"><div><h1>Savdo</h1><p>{currentStore?.name} · {activeShift?<><span className="shift-dot"/> Smena {activeShift.id}</>:<span className="shift-closed-label">Smena yopiq</span>}</p></div><div className="pos-shortcuts"><span><kbd>F2</kbd> Qidiruv</span><span><kbd>Enter</kbd> Qo‘shish</span><span><kbd>F4</kbd> To‘lov</span>{workspaceSettings.pos.holdCartEnabled&&<span><kbd>F6</kbd> Savatni ushlab turish</span>}</div></div>
    {!activeShift&&<div className="pos-shift-warning"><div><FiClock/><span><strong>Smena ochilmagan</strong><small>Savdoni yakunlash bloklangan. Avval Kassa / Smena bo‘limidan smenani oching.</small></span></div><Link to="/shifts">Smenani ochish</Link></div>}
    {activeShift&&(longShift||closeWarning)&&<div className="pos-business-warning pro-alert warning"><FiClock/><span><strong>{longShift?"Smena belgilangan vaqtdan oshdi":"Ish kuni yopilishiga yaqin"}</strong><small>{longShift?`Smena ${maxShiftHours} soatlik limitdan oshdi. Yakunlashni tekshiring.`:`Yopilishgacha ${minutesUntilClose} daqiqa · ${businessClose}. Smenani vaqtida yakunlashni unutmang.`}</small></span><Link to="/shifts">Smenaga o‘tish</Link></div>}
    {error&&<div className="pos-error" role="alert">{error}</div>}
    <div className="pos-mobile-pane-tabs" role="tablist" aria-label="POS ko‘rinishi"><button type="button" role="tab" aria-selected={mobilePane==="catalog"} className={mobilePane==="catalog"?"active":""} onClick={()=>setMobilePane("catalog")}>Mahsulotlar</button><button type="button" role="tab" aria-selected={mobilePane==="cart"} className={mobilePane==="cart"?"active":""} onClick={()=>setMobilePane("cart")}>Savat <b>{cart.reduce((sum,item)=>sum+item.cartQty,0)}</b></button></div>
    <div className="pos-layout-pro">
      <section className={`pos-catalog pro-card ${mobilePane==="catalog"?"mobile-pane-active":"mobile-pane-hidden"}`}>
        <div className="pos-search-row"><div className="pos-search"><FiSearch/><input ref={searchRef} value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={handleSearchKey} placeholder="Mahsulot nomi, SKU yoki shtrix-kod..." aria-label="Mahsulot qidirish"/></div><button type="button" className="pro-btn secondary pos-camera-scan" onClick={()=>setScannerOpen(true)}><FiCamera/> <span>Skanerlash</span></button></div>
        <div className="pos-categories"><button className={category==="all"?"active":""} onClick={()=>setCategory("all")}>Barchasi</button>{categories.map(item=><button key={item} className={category===item?"active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        {!search&&topProducts.length>0&&<div className="quick-products"><span>Tezkor</span>{topProducts.map(product=><button key={product.id} onClick={()=>add(product)} disabled={blockNegative&&product.quantity<=0}>{product.name}</button>)}</div>}
        <div className="pos-product-grid">{products.length?products.map(product=><button className={`pos-product ${blockNegative&&product.quantity<=0?"disabled":""}`} key={product.id} onClick={()=>add(product)} disabled={blockNegative&&product.quantity<=0}><div className="pos-product-icon"><FiPackage/></div><span><strong>{product.name}</strong><small>{product.sku}{product.category?` · ${product.category}`:""}</small></span><div><b>{formatPrice(product.sellPrice||product.price)}</b><em className={product.quantity<=0?"out":product.quantity<=product.minStock?"low":""}>{product.quantity} {product.unit||"dona"}</em></div></button>):<div className="pro-empty"><FiPackage/><strong>Mahsulot topilmadi</strong><span>Shtrix-kod yoki nom bilan qayta qidiring.</span></div>}</div>
        {filteredProducts.length>products.length&&<button type="button" className="pro-btn secondary pos-load-more" onClick={()=>setProductLimit(limit=>limit+40)}>Yana {Math.min(40,filteredProducts.length-products.length)} ta mahsulot</button>}
        <button type="button" className="pos-mobile-cart-bar" onClick={()=>setMobilePane("cart")} disabled={!cart.length}><span><FiShoppingCart/><strong>Savat</strong><small>{cart.reduce((sum,item)=>sum+item.cartQty,0)} dona · {cart.length} tur</small></span><b>{formatPrice(total)}</b></button>
      </section>
      <aside className={`pos-checkout pro-card ${mobilePane==="cart"?"mobile-pane-active":"mobile-pane-hidden"}`}>
        <div className="cart-head"><div><FiShoppingCart/><span><strong>Savat</strong><small>{cart.reduce((sum,item)=>sum+item.cartQty,0)} dona · {cart.length} tur</small></span></div><div className="cart-head-actions">{workspaceSettings.pos.holdCartEnabled&&<button type="button" className={holdToolsOpen?"active":""} onClick={()=>setHoldToolsOpen((value)=>!value)} aria-label="Savatni ushlab turish" title="Savatni ushlab turish"><FiPause/>{held.length>0&&<b>{held.length}</b>}</button>}<button type="button" onClick={()=>setTodaySalesOpen(true)} aria-label="Bugungi savdolar" title="Bugungi savdolar"><FiClock/>{storeDailySales.length>0&&<b>{storeDailySales.length}</b>}</button><button disabled={!cart.length} onClick={clearCart} aria-label="Savatni tozalash" title="Savatni tozalash"><FiTrash2/></button></div></div>
        <div className="pos-checkout-scroll">
        <div className="cart-list">{cart.length?cart.map(item=><div className="cart-item" key={item.id}><div className="cart-item-main"><strong>{item.name}</strong><small>{formatPrice(getFinalUnitPrice(item))}{item.discountPercent?` · ${item.discountPercent}% chegirma`:""}</small></div><div className="qty-control"><button onClick={()=>qty(item.id,item.cartQty-1)} aria-label="Miqdorni kamaytirish"><FiMinus/></button><span className="qty-value" aria-label={`${item.name} miqdori`}>{item.cartQty}</span><button onClick={()=>qty(item.id,item.cartQty+1)} disabled={blockNegative&&item.cartQty>=item.quantity} aria-label="Miqdorni oshirish"><FiPlus/></button></div><strong className="cart-line-total">{formatPrice(getFinalUnitPrice(item)*item.cartQty)}</strong>{canDiscount&&<button className="discount-icon" onClick={()=>{setDiscountItem(item);setDiscount(String(item.discountPercent||""))}} aria-label="Mahsulot chegirmasi"><FiPercent/></button>}</div>):<div className="cart-empty"><FiShoppingBag/><strong>Savat bo‘sh</strong><span>Mahsulotni tanlang yoki barcode skaner qiling.</span></div>}</div>
        <div className="customer-row"><label><FiUser/><input value={customer} onChange={event=>setCustomer(event.target.value)} placeholder="Mijoz (ixtiyoriy)"/></label><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Izoh (ixtiyoriy)"/></div>
        <div className="cart-summary"><div><span>Oraliq summa</span><b>{formatPrice(subtotal)}</b></div>{itemDiscountTotal>0&&<div className="discount"><span>Mahsulot chegirmasi</span><b>-{formatPrice(itemDiscountTotal)}</b></div>}{cartDiscountAmount>0&&<div className="discount"><span>Savat chegirmasi ({cartDiscountPct}%)</span><b>-{formatPrice(cartDiscountAmount)}</b></div>}{canDiscount&&<button className="cart-discount-action" type="button" onClick={()=>{setCartDiscountInput(String(cartDiscountPct));setCartDiscountModal(true)}} disabled={!cart.length}><FiPercent/> Savat chegirmasi</button>}<div className="grand"><span>Jami</span><strong>{formatPrice(total)}</strong></div></div>
        <div className="payment-section"><span className="section-label">To‘lov turi</span><div className="payment-grid">{enabledPaymentTypes.map(type=><button key={type} ref={type==="cash"?checkoutRef:null} className={payment===type?"active":""} onClick={()=>setPayment(type)}>{type==="cash"?<FiDollarSign/>:type==="card"?<FiCreditCard/>:type==="transfer"?<FiRefreshCw/>:<FiLayers/>}<span>{payLabels[type]}</span></button>)}</div>{payment==="cash"&&<div className="cash-box"><label><span>Mijoz bergan summa</span><input inputMode="numeric" value={formatInputMoney(cashTendered)} onChange={event=>setCashTendered(moneyDigits(event.target.value))} placeholder={formatInputMoney(Math.round(total))}/></label><div className={Number(cashTendered||0)<total?"shortage":"change-ok"}><span>{Number(cashTendered||0)<total?"Yetishmaydi":"Qaytim"}</span><strong>{formatPrice(Number(cashTendered||0)<total?Math.max(0,total-Number(cashTendered||0)):change)}</strong></div></div>}{payment==="split"&&<div className="split-box"><label><span>Karta</span><input inputMode="numeric" value={formatInputMoney(splitCard)} onChange={event=>setSplitCard(moneyDigits(event.target.value))}/></label><label><span>O‘tkazma</span><input inputMode="numeric" value={formatInputMoney(splitTransfer)} onChange={event=>setSplitTransfer(moneyDigits(event.target.value))}/></label><div><span>Naqd qismi</span><strong>{formatPrice(splitCash)}</strong></div>{splitCash>0&&<label><span>Mijoz bergan naqd</span><input inputMode="numeric" value={formatInputMoney(splitCashTendered)} onChange={event=>setSplitCashTendered(moneyDigits(event.target.value))} placeholder={formatInputMoney(Math.ceil(splitCash))}/></label>}{splitCash>0&&<div><span>Qaytim</span><strong>{formatPrice(splitChange)}</strong></div>}<div className="split-balance"><span>Jami taqsimlangan</span><strong>{formatPrice(splitCash+splitCardN+splitTransferN)}</strong></div>{!splitValid&&<small className="split-error">{splitMethodCount<2?"Kamida 2 ta to‘lov usulini kiriting":splitCardN+splitTransferN>total?"Karta + o‘tkazma jami summadan oshdi":"Naqd qism uchun mijoz bergan summani kiriting"}</small>}</div>}</div>
        {workspaceSettings.pos.holdCartEnabled&&holdToolsOpen&&<div className="hold-row compact-hold-row"><div className="hold-input"><FiPause/><input value={holdName} onChange={event=>setHoldName(event.target.value)} placeholder="Savat nomi (ixtiyoriy)"/></div><button onClick={holdCart} disabled={!cart.length}><FiPause/> Savatni ushlab turish</button><button onClick={()=>setHeldModal(true)}>Saqlangan savatlar <b>{held.length}</b></button></div>}
        <button className="checkout-primary" disabled={!cart.length||!activeShift||processing||(payment==="cash"&&Number(cashTendered||0)<total)||(payment==="split"&&!splitValid)} onClick={()=>workspaceSettings.pos.saleConfirmation?setSaleConfirmOpen(true):completeSale()}>{processing?"Saqlanmoqda...":!activeShift?"Avval smenani oching":`Savdoni yakunlash · ${formatPrice(total)}`}</button>
        </div>
      </aside>
    </div>

    <BarcodeScannerModal open={scannerOpen} onClose={()=>setScannerOpen(false)} title="Savdo uchun shtrix-kod" onDetected={(code)=>{const product=inventory.find(item=>!item.archived&&String(item.barcode||"").trim()===String(code).trim());if(product){add(product);setSearch("");setScannerOpen(false)}else{setSearch(String(code));setError(`Shtrix-kod ${code} bo‘yicha mahsulot topilmadi`);setScannerOpen(false);requestAnimationFrame(()=>searchRef.current?.focus())}}}/>
    <Modal open={todaySalesOpen} onClose={()=>setTodaySalesOpen(false)} title="Bugungi savdolar" subtitle={`${currentStore?.name||"Filial"} · ${storeDailySales.length} ta tranzaksiya`} size="lg">
      <div className="today-sales-modal">{storeDailySales.length?<div className="today-sales-list">{storeDailySales.slice(0,todaySalesLimit).map(sale=><article key={sale.id}><div className="today-sale-top"><span><strong>Chek #{sale.saleNumber||String(sale.id||"").replace(/[^a-zA-Z0-9]/g,"").slice(-8).toUpperCase()||"—"}</strong><small>{sale.time} · {sale.items?.length||0} tur · {sale.sellerName||sale.seller||"Kassir"}</small></span><strong>{formatPrice(saleNetRevenue(sale))}</strong></div><div className="today-sale-meta"><StatusBadge tone="info">{payLabels[sale.paymentMethod]||sale.paymentMethod}</StatusBadge>{sale.returnedTotal>0&&<StatusBadge tone="warning">Qaytarilgan {formatPrice(sale.returnedTotal)}</StatusBadge>}{canReturn&&<button className="pro-btn secondary today-sale-return" onClick={()=>{setTodaySalesOpen(false);setReturnSale(sale);setReturnItem(null);setReturnReason("");setReturnQty(1);setRefundMethod("original");setReturnError("")}}><FiRefreshCw/> Qaytarish</button>}</div></article>)}{storeDailySales.length>todaySalesLimit&&<button className="pro-btn secondary" onClick={()=>setTodaySalesLimit(limit=>limit+30)}>Yana savdolarni ko‘rsatish</button>}</div>:<div className="pro-empty"><FiClock/><strong>Bugun hali savdo yo‘q</strong><span>Birinchi savdo yakunlangach shu yerda ko‘rinadi.</span></div>}
      {canCloseBusinessDay&&<div className="day-close-wrap"><button className="day-close-btn" disabled={!storeDailySales.length||!!activeShift} onClick={()=>{setTodaySalesOpen(false);setCloseDayModal(true)}}><FiClock/><span><strong>Kunlik savdoni yakunlash</strong><small>{activeShift?"Avval joriy smenani yoping":storeDailySales.length?`${storeDailySales.length} ta tranzaksiyani tarixga o‘tkazish`:"Bugun yakunlanadigan savdo yo‘q"}</small></span></button></div>}
      </div>
    </Modal>
    <Modal open={closeDayModal} onClose={()=>setCloseDayModal(false)} title="Kunlik savdoni yakunlash" subtitle="Bugungi tranzaksiyalar Savdo tarixi bo‘limiga o‘tkaziladi." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setCloseDayModal(false)}>Bekor qilish</button><button className="pro-btn primary" onClick={closeBusinessDay}>Yakunlash</button></>}><div className="day-close-summary"><div><span>Tranzaksiyalar</span><strong>{storeDailySales.length}</strong></div><div><span>Sof savdo</span><strong>{formatPrice(storeDailySales.reduce((sum,sale)=>sum+saleNetRevenue(sale),0))}</strong></div></div></Modal>
    <Modal open={heldModal} onClose={()=>setHeldModal(false)} title="Ushlab turilgan savatlar" subtitle="Vaqtinchalik saqlangan savdolarni davom ettiring yoki o‘chiring." size="lg">{held.length?<div className="held-list-pro">{held.map(item=><div key={item.id}><div className="held-icon"><FiPause/></div><span><strong>{item.name}</strong><small>{new Date(item.createdAt).toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"})} · {item.cart.length} tur · {item.cashier}</small></span><b>{formatPrice(item.total)}</b><button className="pro-btn primary" onClick={()=>restoreHold(item)}>Davom ettirish</button><button className="pro-icon-btn held-delete" onClick={()=>requestDeleteHold(item)} aria-label="Ushlab turilgan savatni o‘chirish"><FiTrash2/></button></div>)}</div>:<div className="pro-empty"><FiPause/><strong>Ushlab turilgan savat yo‘q</strong><span>Savdo paytida savatni vaqtincha saqlab, keyin davom ettirishingiz mumkin.</span></div>}</Modal>
    <Modal open={!!discountItem} onClose={()=>setDiscountItem(null)} title="Mahsulot chegirmasi" subtitle={discountItem?.name} size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setDiscountItem(null)}>Bekor qilish</button><button className="pro-btn primary" onClick={applyDiscount}>Qo‘llash</button></>}><label className="pro-field"><span>Chegirma (%) · mavjud limit {maxItemDiscountAllowed.toFixed(1)}%</span><input autoFocus type="number" min="0" max={maxItemDiscountAllowed} value={discount} onChange={event=>setDiscount(event.target.value)}/></label></Modal>
    <Modal open={cartDiscountModal} onClose={()=>setCartDiscountModal(false)} title="Savat chegirmasi" subtitle="Chegirma barcha savat pozitsiyalariga teng qo‘llanadi." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setCartDiscountModal(false)}>Bekor qilish</button><button className="pro-btn primary" onClick={applyCartDiscount}>Qo‘llash</button></>}><label className="pro-field"><span>Chegirma (%) · mavjud limit {maxCartDiscountAllowed.toFixed(1)}%</span><input autoFocus type="number" min="0" max={maxCartDiscountAllowed} value={cartDiscountInput} onChange={event=>setCartDiscountInput(event.target.value)}/></label></Modal>
    <Modal open={saleConfirmOpen} onClose={()=>setSaleConfirmOpen(false)} title="Savdoni tasdiqlash" subtitle="To‘lovni yakunlashdan oldin summani tekshiring." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setSaleConfirmOpen(false)}>Ortga</button><button className="pro-btn primary" disabled={processing} onClick={()=>{setSaleConfirmOpen(false);completeSale()}}>Tasdiqlash · {formatPrice(total)}</button></>}><div className="sale-confirm-summary"><div><span>Mahsulotlar</span><strong>{cart.reduce((sum,item)=>sum+Number(item.cartQty||0),0)} ta</strong></div><div><span>To‘lov</span><strong>{payLabels[payment]}</strong></div>{discountTotal>0&&<div><span>Chegirma</span><strong>−{formatPrice(discountTotal)}</strong></div>}<div className="grand"><span>Jami</span><strong>{formatPrice(total)}</strong></div>{payment==="split"&&<small>Naqd {formatPrice(splitCash)} · Karta {formatPrice(splitCardN)} · O‘tkazma {formatPrice(splitTransferN)}</small>}</div></Modal>
    <Modal open={!!receipt} onClose={()=>setReceipt(null)} title="Savdo muvaffaqiyatli" subtitle={`${receipt?.saleNumber||receipt?.id||""} · ${payLabels[receipt?.paymentMethod]||""}`} size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setReceipt(null)}>Yopish</button><button className="pro-btn primary" onClick={()=>window.print()}><FiPrinter/> Chop etish</button></>}><div className="receipt-print-stack">{Array.from({length:receiptCopies},(_,copyIndex)=><div className={`receipt-preview-pro width-${workspaceSettings.receipt.width} ${copyIndex?"receipt-print-copy-extra":""}`} key={`receipt-copy-${copyIndex}`}>{workspaceSettings.receipt.showLogo&&<><h3>{organizationSettings.businessName||"Zenix POS"}</h3><small className="receipt-powered">Zenix POS</small></>}<p>{currentStore?.name}</p><div className="receipt-sep"/>{receipt?.items.map(item=><div className="receipt-line" key={`${copyIndex}-${item.id}`}><span>{item.name}<small>{item.quantity} × {formatPrice(item.finalPrice)}</small></span><b>{formatPrice(item.finalPrice*item.quantity)}</b></div>)}<div className="receipt-sep"/><div className="receipt-total"><span>JAMI</span><strong>{formatPrice(receipt?.total||0)}</strong></div><div className="receipt-info-pro"><span>To‘lov: {payLabels[receipt?.paymentMethod]}</span>{workspaceSettings.receipt.showPaymentBreakdown&&receipt?.paymentMethod==="split"&&<span>Naqd {formatPrice(receipt.paymentBreakdown?.cash||0)} · Karta {formatPrice(receipt.paymentBreakdown?.card||0)} · O‘tkazma {formatPrice(receipt.paymentBreakdown?.transfer||0)}</span>}{workspaceSettings.receipt.showCashier&&<span>Kassir: {receipt?.sellerName}</span>}<span>{receipt?.date} {receipt?.time}</span></div><p className="receipt-footer">{workspaceSettings.receipt.footer}</p></div>)}</div></Modal>
    <Modal open={!!returnSale} onClose={()=>{setReturnSale(null);setReturnError("")}} title="Qaytarish" subtitle={`${returnSale?.saleNumber||returnSale?.id||""} · mahsulot va miqdorni tanlang`} footer={<><button className="pro-btn secondary" onClick={()=>{setReturnSale(null);setReturnError("")}}>Bekor qilish</button><button className="pro-btn danger" disabled={returnProcessing||!returnItem||!returnReason||returnQty<=0} onClick={performReturn}>{returnProcessing?"Saqlanmoqda...":"Qaytarishni tasdiqlash"}</button></>}><div className="return-items-pro">{returnSale?.items?.map(item=>{const available=Number(item.quantity||0)-Number(item.returnedQty||0);return <button key={item.id} disabled={available<=0} className={returnItem?.id===item.id?"active":""} onClick={()=>{setReturnItem(item);setReturnQty(1);setReturnError("")}}><span><strong>{item.name}</strong><small>{available} dona qaytarish mumkin</small></span><b>{formatPrice(item.finalPrice||item.price)}</b></button>})}</div>{returnItem&&<div className="pro-form-grid return-form"><label className="pro-field"><span>Miqdor</span><input data-modal-autofocus type="number" min="1" max={Math.max(1,Number(returnItem.quantity||0)-Number(returnItem.returnedQty||0))} value={returnQty} onChange={event=>{setReturnQty(Number(event.target.value));setReturnError("")}}/></label><label className="pro-field"><span>Qaytarish usuli</span><PremiumSelect value={refundMethod} onChange={event=>{setRefundMethod(event.target.value);setReturnError("")}}><option value="original">Asl to‘lov usuli</option><option value="cash">Naqd</option><option value="card">Karta</option><option value="transfer">O‘tkazma</option></PremiumSelect></label><label className="pro-field full"><span>Qaytarish sababi *</span><PremiumSelect value={returnReason} onChange={event=>{setReturnReason(event.target.value);setReturnError("")}}><option value="">Tanlang</option>{RETURN_REASONS.map(reason=><option key={reason}>{reason}</option>)}<option>Boshqa</option></PremiumSelect></label>{returnError&&<div className="pro-alert danger full">{returnError}</div>}</div>}</Modal>
  </div>;
}
export default Sales;
