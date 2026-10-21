import {useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiGrid,FiZap,FiCamera,FiArrowRight,FiPause,FiFolder,FiPrinter,FiTrash2,FiCreditCard,FiDollarSign} from 'react-icons/fi';
import useWorkspaceAppearance from '../../utils/useWorkspaceAppearance';
import usePosWindowLease from './usePosWindowLease';
import WorkspaceHeader from './WorkspaceHeader';
import Tracking from './Tracking';
import {useAuth} from '../../context/AuthContext';
import {useStore} from '../../context/StoreContext';
import {useFeedback} from '../../context/FeedbackContext';
import useUnsavedGuard from '../../utils/useUnsavedGuard';
import {api} from '../../services/apiClient';
import {workspaceTime} from '../../utils/workspaceDate';
import Modal from '../../components/Modal';
import {PremiumSelect} from '../../components/Ui';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import useProCatalog from './useProCatalog';
import useProSession from './useProSession';
import {createHidScanner,decodeWeightBarcode,validateWeightSchemes,hardwareCapabilities} from './hardware';
import {cartTotals,formatProMoney as formatPrice} from './model';
import {selectSearchResult} from './catalogSelection';
import Cart from './Cart';
import Payment,{paymentLabels} from './Payment';
import Receipt,{printReceipt} from './Receipt';
import './posPro.scss';

export default function PosPro(){
 const {currentUser}=useAuth(),store=useStore();
 useWorkspaceAppearance(store.uiPreferences,store.effectiveWorkspaceSettings);
 const identity=`${currentUser.organizationId}:${currentUser.id}:${store.currentStoreId}`,lease=usePosWindowLease(identity),navigate=useNavigate();
 return <main className="pos-pro-shell">{lease.state==='owned'?<Workspace key={identity} user={currentUser} store={store}/>:<section className="pp-lease" role="status"><img src="/zenix-logo.png" alt="ZENIX POS" width="56" height="56"/><h1>POS Pro</h1><h2>{lease.state==='waiting'?'Ish maydoni tekshirilmoqda':lease.state==='blocked'?'POS boshqa oynada ochiq':'Xavfsiz oynalar nazorati mavjud emas'}</h2><p>{lease.state==='blocked'?'Bir kassir va filial uchun bitta faol POS oynasi ishlaydi. Avval boshqa POS oynasini yoping. Draft va savdo jurnali himoyalangan.':lease.state==='unsupported'?'Ushbu brauzer Web Locks imkoniyatini bermadi. Chrome yoki Edge orqali localhost / HTTPS manzilini oching. Savdo bloklangan.':'Sessiya va draft himoyasi tekshirilmoqda.'}</p><button onClick={lease.retry} disabled={lease.state==='waiting'}>Qayta tekshirish</button><button onClick={()=>navigate('/sales')}>Platformaga qaytish</button></section>}</main>;

}
function Workspace({user,store}){
 const {confirm,guardNavigation}=useFeedback(),navigate=useNavigate(),catalog=useProCatalog(store.currentStoreId),settings=store.effectiveWorkspaceSettings;
 const canDiscount=user.appRole!=='CASHIER'||settings.pos.cashierDiscountAllowed===true,discountLimit=Math.max(0,Number(settings.pos.discountLimit??20)),creditAllowed=settings.pos.paymentMethods?.credit!==false;
 const session=useProSession({user,store,catalog,canDiscount,discountLimit,creditAllowed});
 const [search,setSearch]=useState(''),[category,setCategory]=useState(''),[barcode,setBarcode]=useState(''),[online,setOnline]=useState(navigator.onLine),[clock,setClock]=useState(new Date());
 const [modal,setModal]=useState(''),[payment,setPayment]=useState(''),[kiosk,setKiosk]=useState(Boolean(document.fullscreenElement)),[camera,setCamera]=useState(false),[priceProduct,setPriceProduct]=useState(null),[scanPending,setScanPending]=useState(0);
 const [summary,setSummary]=useState(null),[summaryError,setSummaryError]=useState(''),[catalogMode,setCatalogMode]=useState('all'),[customerQuery,setCustomerQuery]=useState(''),[customers,setCustomers]=useState([]),[width,setWidth]=useState(String(settings.receipt.width||'80'));
 const deviceKey=`zenix:pos-pro-device:v1:${user.organizationId}:${user.id}:${store.currentStoreId}`;
 const [schemeText,setSchemeText]=useState(()=>{try{return localStorage.getItem(deviceKey)||'[]'}catch{return '[]'}}),[schemes,setSchemes]=useState(()=>{try{return validateWeightSchemes(JSON.parse(localStorage.getItem(deviceKey)||'[]'))}catch{return []}});
 const [configError,setConfigError]=useState(''),[openingCash,setOpeningCash]=useState(''),[shiftBusy,setShiftBusy]=useState(false),[shiftError,setShiftError]=useState(''),[trackingId,setTrackingId]=useState(null);
 const [activeProductId,setActiveProductId]=useState(null);
 const searchRef=useRef(null),barcodeRef=useRef(null),queue=useRef(Promise.resolve()),pendingScans=useRef(0),active=useRef(true),actions=useRef(null),lastSale=useRef(null),summaryRequest=useRef(false);
 const totals=useMemo(()=>cartTotals(session.cart,session.cartPct),[session.cart,session.cartPct]);
 const options={width,business:settings.organization?.businessName||user.organizationName||'ZENIX POS',branch:store.currentStore?.name,cashier:user.name};
 useEffect(()=>{const changed=()=>setKiosk(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[]);
 useEffect(()=>{if(session.ready&&!modal&&!payment&&!camera&&!trackingId&&!session.receipt)barcodeRef.current?.focus()},[session.ready,modal,payment,camera,trackingId,session.receipt]);
 useUnsavedGuard(session.cart.length>0||Boolean(session.recovery)||Boolean(session.holdRecovery),'Joriy POS Pro chek drafti saqlanadi. Noma’lum to‘lov bo‘lsa, shu savdoni qayta tekshiring.');
 useEffect(()=>{active.current=true;const tick=setInterval(()=>setClock(new Date()),1000);const status=()=>setOnline(navigator.onLine);window.addEventListener('online',status);window.addEventListener('offline',status);return()=>{active.current=false;clearInterval(tick);window.removeEventListener('online',status);window.removeEventListener('offline',status)}},[]);
 useEffect(()=>{const timer=setTimeout(()=>{void catalog.search({...(search.trim()?{search:search.trim()}:{}),...(category?{category}:{})})},160);return()=>clearTimeout(timer)},[search,category,catalog.search]);
 const refreshSummary=async()=>{
  if(!navigator.onLine||document.hidden||summaryRequest.current)return;summaryRequest.current=true;
  try{const data=await api.get(`/api/sales/pos-pro/summary?${new URLSearchParams({storeId:store.currentStoreId,...(store.activeShift?{shiftId:store.activeShift.id}:{})})}`,{signal:AbortSignal.timeout(10000)});if(active.current){setSummary(data);setSummaryError('')}}
  catch(e){if(active.current)setSummaryError(e.status===404?'Live panel uchun Phase 2 backend kerak.':e.message)}finally{summaryRequest.current=false}
 };
 const refreshRef=useRef(refreshSummary);refreshRef.current=refreshSummary;
 useEffect(()=>{void refreshRef.current();const interval=setInterval(()=>void refreshRef.current(),60000);const visible=()=>{if(!document.hidden)void refreshRef.current()};window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);return()=>{clearInterval(interval);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible)}},[store.activeShift?.id]);
 useEffect(()=>{if(!session.receipt)return;lastSale.current=session.receipt;void refreshRef.current()},[session.receipt]);
 useEffect(()=>{if(catalogMode==='popular'&&summary?.popular?.length)void catalog.resolve(summary.popular.map(p=>p.product_id)).catch(e=>session.setError(e.message))},[catalogMode,summary]);
 useEffect(()=>{if(modal!=='customer')return;let current=true;const t=setTimeout(()=>{api.get(`/api/customers?q=${encodeURIComponent(customerQuery)}&limit=12`).then(data=>{if(current)setCustomers(data.items||[])}).catch(e=>{if(current)session.setError(e.message)})},180);return()=>{current=false;clearTimeout(t)}},[modal,customerQuery]);
 const lookup=async(code)=>{
  try{return {product:await catalog.barcode(code),quantity:1}}
  catch(e){if(e.code!=='BARCODE_NOT_FOUND')throw e;
   const decoded=decodeWeightBarcode(code,schemes);if(!decoded)throw e;
   const product=await catalog.barcode(decoded.productCode),unit=String(product.unit||'').toLowerCase();
   const units={kg:['mass',1],g:['mass',.001],gr:['mass',.001],gramm:['mass',.001],l:['volume',1],litr:['volume',1],ml:['volume',.001]};
   const from=units[decoded.unit],to=units[unit];if(!to||from[0]!==to[0])throw Error('Tarozi va mahsulot birliklari mos emas');
   const raw=decoded.amount!==undefined?decoded.amount/Number(product.sellPrice):decoded.quantity*from[1]/to[1],quantity=Math.round(raw*1000)/1000;
   if(!Number.isFinite(quantity)||quantity<=0||Math.abs(raw-quantity)>0.0000001)throw Error('Yorliq miqdori mahsulotning 0.001 aniqligiga mos emas');
   return {product,quantity};
  }
 };
 const enqueue=(code,priceOnly=false)=>{
  code=String(code||'').trim();if(!code||(!priceOnly&&session.locked))return;
  pendingScans.current++;setScanPending(pendingScans.current);setBarcode('');
  queue.current=queue.current.then(async()=>{try{const found=await lookup(code);if(!active.current)return;if(priceOnly)setPriceProduct(found.product);else actions.current.session.add(found.product,found.quantity)}catch(e){if(active.current)session.setError(e.message)}finally{pendingScans.current--;if(active.current)setScanPending(pendingScans.current)}});
 };
 const openPayment=method=>{
  if(session.locked||pendingScans.current)return;
  if(!online){session.setError('Internet yo‘q: savdo yozilmaydi, draft saqlangan.');return}
  if(!store.activeShift){session.setError('Avval smena oching');return}
  if(!session.cart.length){session.setError('Chek bo‘sh');return}
  if(settings.pos.paymentMethods?.[method]===false){session.setError('Ushbu to‘lov usuli filialda o‘chirilgan');return}
  if(method==='credit'&&!session.customerId){setModal('customer');session.setError('Nasiya uchun mijoz tanlang');return}
  session.setError('');setPayment(method);
 };
 const remove=async id=>{if(session.locked||pendingScans.current)return;const ok=await confirm({title:'Mahsulotni olib tashlash',message:'Mahsulot joriy chekdan olib tashlanadi.',confirmLabel:'Olib tashlash',tone:'danger'});if(ok)session.remove(id)};
 const clear=async()=>{if(session.locked||pendingScans.current||!session.cart.length)return;const ok=await confirm({title:'Chekni bekor qilish',message:'Joriy chek tozalanadi. Serverda savdo yaratilmaydi.',confirmLabel:'Chekni bekor qilish',tone:'danger'});if(ok)session.reset()};
 const holdCurrent=()=>{if(session.locked||pendingScans.current||!online||settings.pos.holdCartEnabled===false)return;void session.hold()};
 const holds=()=>{if(session.locked||pendingScans.current)return;setModal('holds');void session.loadHolds()};
 const print=()=>{const sale=session.receipt||lastSale.current;if(sale)printReceipt(sale,options);else session.setError('Avval server tasdiqlagan savdoni yakunlang')};
 actions.current={session,enqueue,openPayment,holdCurrent,holds,print,modal,payment};
 useEffect(()=>{
  const scanner=createHidScanner(code=>actions.current.enqueue(code));
  const shortcuts={F2:()=>searchRef.current?.focus(),F3:()=>barcodeRef.current?.focus(),F4:()=>{setPriceProduct(null);setModal('price')},F5:()=>actions.current.holdCurrent(),F6:()=>actions.current.holds(),F7:()=>actions.current.openPayment('cash'),F8:()=>actions.current.openPayment('card'),F9:()=>actions.current.openPayment('split'),F10:()=>actions.current.print(),F12:()=>actions.current.openPayment('cash')};
  const handle=e=>{
   const blocked=Boolean(document.querySelector('[role="dialog"],[aria-modal="true"]')),editable=Boolean(e.target.closest?.('input,textarea,select,[contenteditable="true"]'));
   if(blocked&&e.key==='F10'&&actions.current.session.receipt){e.preventDefault();if(!e.repeat)actions.current.print();return}
   if(e.key==='Escape'&&!blocked&&document.fullscreenElement){void document.exitFullscreen?.();return}
   if(e.key==='F5'&&(e.ctrlKey||e.metaKey||e.shiftKey||!actions.current.session.cart.length))return;
   const key=e.altKey&&/^\d$/.test(e.key)?`F${e.key==='0'?10:e.key}`:e.key;
   if(!blocked&&shortcuts[key]){e.preventDefault();e.stopPropagation();scanner.reset();if(!e.repeat)shortcuts[key]();return}
   if(scanner.key({key:e.key,repeat:e.repeat,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,blocked,editable}))e.preventDefault();
  };
  window.addEventListener('keydown',handle,true);return()=>window.removeEventListener('keydown',handle,true);
 },[kiosk]);
 const products=catalogMode==='popular'?(summary?.popular||[]).map(p=>catalog.view.products.find(v=>v.id===p.product_id)).filter(Boolean):catalog.view.results;
 const searchReady=!catalog.pending&&!catalog.error&&catalog.appliedQuery?.search===search.trim()&&catalog.appliedQuery?.category===category;
 const chooseProduct=product=>{if(session.locked||search.trim()&&!searchReady)return;session.add(product);if(search.trim()){setSearch('');setActiveProductId(null);barcodeRef.current?.focus()}};
 const searchKey=event=>{
  if(!['Enter','ArrowDown','ArrowUp'].includes(event.key))return;
  event.preventDefault();if(event.repeat||!search.trim()||!searchReady||session.locked)return;
  const available=products.filter(p=>!p.archived&&p.quantity>0);
  if(event.key==='Enter'){const selected=selectSearchResult(available,search,activeProductId);if(selected)chooseProduct(selected);return}
  if(!available.length)return;
  const index=available.findIndex(p=>p.id===activeProductId),next=event.key==='ArrowDown'?(index+1)%available.length:(index<=0?available.length:index)-1;
  setActiveProductId(available[next].id);document.getElementById(`pp-product-${available[next].id}`)?.scrollIntoView({block:'nearest'});
 };
 const saveSchemes=()=>{try{const parsed=validateWeightSchemes(JSON.parse(schemeText));localStorage.setItem(deviceKey,JSON.stringify(parsed));setSchemes(parsed);setConfigError('');setModal('')}catch(e){setConfigError(e.message)}};
 const caps=hardwareCapabilities();
 return <div className={`pos-pro${kiosk?' pp-kiosk':''}`}>
  <WorkspaceHeader store={store} user={user} disabled={session.locked||session.cart.length>0||scanPending>0} online={online} time={workspaceTime(clock,settings.organization)} fullscreen={kiosk} onFullscreen={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else session.setError('Brauzer to‘liq ekran imkoniyatini bermadi. POS mustaqil oynada ishlaydi.')}catch{session.setError('To‘liq ekran ochilmadi. Brauzer ruxsatini tekshiring.')}}} onDevices={()=>setModal('hardware')} onReturn={()=>guardNavigation(()=>navigate('/sales'))}/>
  {!online&&<div className="pp-warning" role="status">Internet yo‘q. Faqat draft saqlanadi; savdo serverga yozilmaydi.</div>}
  {!store.activeShift&&<section className="pp-shift-gate" role="status"><div><strong>Smena yopiq</strong><p>{session.cart.length?'Draft — hali sotilmagan. Savat saqlangan; to‘lov uchun smena oching.':'Savdoni boshlash uchun smena oching. Checkout server tasdig‘isiz bajarilmaydi.'}</p></div><button disabled={!online||session.locked||scanPending>0||!store.hasPermission('moduleShifts')} onClick={()=>{setShiftError('');setModal('shift')}}>Smenani ochish</button><button disabled={shiftBusy} onClick={()=>store.reloadStore({silent:true})}>Holatni yangilash</button></section>}
  {session.error&&<div className="pp-error" role="alert">{session.error}<button aria-label="Xabarni yopish" onClick={()=>session.setError('')}>×</button></div>}
  {session.notice&&<div className="pp-warning" role="status">{session.notice}<button onClick={()=>session.setNotice('')}>Tushunarli</button></div>}
  {session.recovery&&<div className="pp-recovery"><strong>Oldingi savdo natijasi tekshirilishi kerak.</strong><button disabled={session.busy||!online} onClick={()=>session.recover()}>Natijani tekshirish</button><button disabled={session.busy||!online} onClick={()=>session.recover(true)}>Aynan shu savdoni qayta yuborish</button></div>}
  {session.holdRecovery&&<div className="pp-recovery">Hold natijasi noma’lum. Savat himoyalangan.<button disabled={session.busy||!online} onClick={()=>session.hold()}>Hold saqlashni qayta tekshirish</button></div>}
  <div className="pp-workspace">
   <section className="pp-catalog pp-panel" aria-label="Mahsulot katalogi"><div className="pp-panel-head"><h2>Mahsulotlar</h2><span>{scanPending?`${scanPending} skan kutilmoqda`:'Klaviatura / HID kiritish'}</span></div><label className="pp-barcode-label" htmlFor="pp-barcode">Barcode · F3</label><form className="pp-barcode" onSubmit={e=>{e.preventDefault();enqueue(barcode)}}><input id="pp-barcode" ref={barcodeRef} aria-label="Barcode" placeholder="Barcode · F3" value={barcode} onChange={e=>setBarcode(e.target.value)} autoComplete="off"/><button type="submit" disabled={session.locked} aria-label="Barcode qo‘shish"><FiArrowRight/></button><button type="button" aria-label="Kamera scanner" disabled={session.locked} onClick={()=>setCamera(true)}><FiCamera/></button></form><label className="pp-field"><span>Tezkor qidiruv · F2</span><input ref={searchRef} aria-label="POS Pro qidiruv" placeholder="Nomi yoki SKU" value={search} role="combobox" aria-autocomplete="list" aria-expanded={Boolean(search.trim())} aria-controls="pp-catalog-results" aria-activedescendant={activeProductId?`pp-product-${activeProductId}`:undefined} aria-describedby="pp-search-help" onChange={e=>{setSearch(e.target.value);setActiveProductId(null);setCatalogMode('all')}} onKeyDown={searchKey}/></label><small id="pp-search-help">{search.trim()&&!searchReady?'Natijalar yangilanmoqda...':'↑/↓ tanlash · Enter qo‘shish'}</small><div className="pp-catalog-tabs"><button aria-pressed={catalogMode==='all'} onClick={()=>setCatalogMode('all')}><FiGrid/>Katalog</button><button aria-pressed={catalogMode==='popular'} onClick={()=>{setSearch('');setActiveProductId(null);setCatalogMode('popular')}}><FiZap/>Smenada ko‘p sotilgan</button></div><PremiumSelect aria-label="Kategoriya" value={category} onChange={e=>{setCategory(e.target.value);setActiveProductId(null);setCatalogMode('all')}}><option value="">Barcha kategoriyalar</option>{catalog.view.categories.map(c=><option key={c}>{c}</option>)}</PremiumSelect>
    {catalog.error&&<div className="pp-error" role="alert">{catalog.error}<button onClick={()=>catalog.search({search,category})}>Qayta urinish</button></div>}
    <div className="pp-products" id="pp-catalog-results" role="listbox" aria-label="Qidiruv natijalari" aria-busy={catalog.pending}>{products.map(p=><button key={p.id} id={`pp-product-${p.id}`} role="option" aria-selected={activeProductId===p.id} className="pp-product" disabled={session.locked||p.archived||p.quantity<=0||Boolean(search.trim()&&!searchReady)} onClick={()=>chooseProduct(p)}><strong>{p.name}</strong><b>{formatPrice(p.sellPrice)}</b><small><span className={p.quantity<=0?'pp-stock-empty':p.quantity<3?'pp-stock-low':''}>{p.quantity<=0?'Qoldiq tugagan':`${p.quantity} ${p.unit||'dona'} mavjud`}</span><span>{p.barcode||p.sku||'Barcode yo‘q'}</span></small></button>)}{!products.length&&<div className="pp-empty">{catalog.pending?'Yuklanmoqda…':'Mahsulot topilmadi'}</div>}</div>{catalogMode==='all'&&catalog.view.hasMore&&<button disabled={catalog.pending} onClick={()=>catalog.search({},true)}>Yana 40 mahsulot</button>}<button onClick={()=>{setPriceProduct(null);setModal('price')}}>Narx tekshirish · F4</button>
   </section>
   <Cart session={session} canDiscount={canDiscount} onRemove={remove} onTracking={setTrackingId} shiftOpen={Boolean(store.activeShift)}/>
   <aside className="pp-terminal pp-panel" aria-label="To‘lov terminali"><div className="pp-terminal-heading"><h2>Jami</h2><button className="pp-customer" disabled={session.locked} onClick={()=>setModal('customer')}>{session.customer?`Mijoz: ${session.customer}`:'Mijoz tanlash'}</button></div><div className="pp-total"><small>To‘lanadi · UZS</small><strong data-testid="pos-pro-total">{formatPrice(totals.total)}</strong></div><div className="pp-terminal-body"><div className="pp-totals-row"><span>Subtotal</span><b>{formatPrice(totals.subtotal)}</b></div><div className="pp-totals-row"><span>Chegirma</span><b>−{formatPrice(totals.discount)}</b></div><label className="pp-field">Savat chegirmasi %<input aria-label="Savat chegirmasi" type="number" min="0" max={discountLimit} disabled={session.locked||!canDiscount} value={session.cartPct} onChange={e=>session.discount(null,e.target.value)}/></label><div className="pp-payments">{Object.entries(paymentLabels).filter(([method])=>settings.pos.paymentMethods?.[method]!==false&&(method!=='credit'||creditAllowed)).map(([method,label])=><button key={method} className={`pp-pay-${method}`} disabled={session.locked||!session.cart.length||scanPending>0||!online||!store.activeShift} onClick={()=>openPayment(method)}><span className="pp-payment-label">{method==='cash'?<FiDollarSign/>:<FiCreditCard/>}{label}</span><kbd>{({cash:'F7',card:'F8',split:'F9'})[method]}</kbd></button>)}</div></div><div className="pp-settlement"><button className="pp-checkout" disabled={session.locked||!session.cart.length||scanPending>0||!online||!store.activeShift} onClick={()=>openPayment('cash')}>Savdoni yakunlash <kbd>F12</kbd></button><p className="pp-checkout-reason" role="status">{!store.activeShift?'Avval smenani oching':!online?'Offline: faqat draft saqlanadi':session.recovery||session.holdRecovery?'Avval oldingi amal natijasini tekshiring':scanPending?'Barcode javobi kutilmoqda':session.locked?'Server tekshiruvi kutilmoqda':!session.cart.length?'Savatga mahsulot qo‘shing':'To‘lov keyingi oynada alohida tasdiqlanadi'}</p></div><div className="pp-cart-actions"><button disabled={session.locked||!session.cart.length||scanPending>0||settings.pos.holdCartEnabled===false||!online} onClick={holdCurrent}><FiPause/>Hold · F5</button><button disabled={session.locked} onClick={holds}><FiFolder/>Cheklar · F6</button><button disabled={session.locked||!session.cart.length||scanPending>0} onClick={clear}><FiTrash2/>Bekor qilish</button><button disabled={!lastSale.current&&!session.receipt} onClick={print}><FiPrinter/>Chek · F10</button></div>
    <details className="pp-live"><summary>Joriy smena · Live panel</summary>{summaryError?<p>{summaryError}<button onClick={refreshSummary}>Yangilash</button></p>:summary?<><div><span>Savdo</span><b>{formatPrice(summary.total)}</b></div><div><span>Cheklar</span><b>{summary.count}</b></div><div><span>Naqd</span><b>{formatPrice(summary.cash)}</b></div><div><span>Karta</span><b>{formatPrice(summary.card)}</b></div>{summary.recent?.map(s=><p key={s.id}>{s.sale_number} · {formatPrice(s.total)}</p>)}<small>Server ma’lumoti · har 60 soniyada</small></>:<p>Yuklanmoqda…</p>}</details>
   </aside>
  </div>
  <footer className="pp-shortcuts">Klaviatura kiritishi mavjud · Fizik scanner tekshirilmagan · F2 Qidiruv · F3 Barcode · F4 Narx · F5 Hold (Ctrl+R yangilash) · F6 Cheklar · F7 Naqd · F8 Karta · F9 Aralash · F10 Chek · F12 Yakunlash · Muqobil: ekrandagi tugmalar, Alt+2…9</footer>
  {payment&&<Payment key={payment} method={payment} total={totals.total} customerId={session.customerId} creditAllowed={creditAllowed} busy={session.busy} error={session.error} onClose={()=>{setPayment('');barcodeRef.current?.focus()}} onConfirm={async input=>{const success=await session.checkout(input);if(active.current){setPayment('');if(!success)barcodeRef.current?.focus()}}}/>}
  <Modal open={modal==='shift'} onClose={()=>!shiftBusy&&setModal('')} title="Smena ochish" subtitle="Joriy filial kassasidagi boshlang‘ich naqd summani kiriting." footer={<button className="pro-btn primary" disabled={shiftBusy||!online||openingCash===''||!Number.isFinite(Number(openingCash))||Number(openingCash)<0} onClick={async()=>{setShiftBusy(true);setShiftError('');try{const result=await store.commitShiftOpen({shift:{id:`PRO-SHIFT-${crypto.randomUUID()}`,storeId:store.currentStoreId,openingCash:Number(openingCash)}});if(result?.success){setModal('');setOpeningCash('')}else{setShiftError(result?.message||'Smena ochilmadi. Holatni yangilang.');await store.reloadStore({silent:true})}}catch(e){setShiftError(e.message)}finally{setShiftBusy(false)}}}>{shiftBusy?'Server tekshiruvi...':'Smenani ochish'}</button>}><label className="pp-field">Boshlang‘ich naqd<input aria-label="Boshlang‘ich naqd" type="number" min="0" value={openingCash} disabled={shiftBusy} onChange={e=>setOpeningCash(e.target.value)}/></label>{shiftError&&<p role="alert" className="pp-error">{shiftError}</p>}</Modal>
  {trackingId&&session.cart.some(p=>p.id===trackingId)&&<Tracking key={trackingId} line={session.cart.find(p=>p.id===trackingId)} storeId={store.currentStoreId} onSave={selection=>session.tracking(trackingId,selection)} onClose={()=>setTrackingId(null)}/>}
  <Modal open={modal==='holds'} onClose={()=>!session.busy&&setModal('')} title="Kutayotgan cheklar"><div className="pp-holds">{session.held.length?session.held.map(h=><button disabled={session.locked} key={h.id} onClick={async()=>{if(await session.resume(h))setModal('')}}><strong>{h.name}</strong><span>{h.cart.length} qator · {formatPrice(h.total)}</span><small>{h.customer}</small></button>):<p>Hold cheklari yo‘q.</p>}</div></Modal>
  <Modal open={modal==='price'} onClose={()=>setModal('')} title="Narx tekshirish"><form className="pp-barcode" onSubmit={e=>{e.preventDefault();enqueue(barcode,true)}}><input aria-label="Narx uchun barcode" placeholder="Barcode kiriting va Enter" value={barcode} onChange={e=>setBarcode(e.target.value)}/><button>Tekshirish</button></form>{priceProduct&&<div className="pp-price-check"><h3>{priceProduct.name}</h3><strong>{formatPrice(priceProduct.sellPrice)} / {priceProduct.unit}</strong><p>Qoldiq: {priceProduct.quantity} {priceProduct.unit}</p></div>}</Modal>
  <Modal open={modal==='customer'} onClose={()=>setModal('')} title="Mijoz tanlash"><label className="pp-field">Ism yoki telefon<input value={customerQuery} onChange={e=>setCustomerQuery(e.target.value)}/></label><div className="pp-holds"><button onClick={()=>{session.setCustomer('');session.setCustomerId('');setModal('')}}>Mijozsiz davom etish</button>{customers.map(c=><button key={c.id} onClick={()=>{session.setCustomer(c.name);session.setCustomerId(c.id);setModal('')}}><strong>{c.name}</strong><small>{c.phone}</small></button>)}</div></Modal>
  <Modal open={modal==='hardware'} onClose={()=>setModal('')} title="Qurilmalar va chek"><div className="pp-hardware"><p>Klaviatura / HID kiritishi mavjud. Fizik scanner tekshirilmagan; ulanish holati brauzer orqali aniqlanmaydi. Scanner Enter suffix yuborishi kerak.</p><label className="pp-field">Chek eni<PremiumSelect value={width} onChange={e=>setWidth(e.target.value)}><option value="58">58 mm</option><option value="80">80 mm</option></PremiumSelect></label><p>Brauzer orqali chop etish mavjud. Printer dialogida mos qog‘ozni tanlang.</p><p>Web Serial API: {caps.serialAPI?'brauzerda mavjud':'mavjud emas'}. WebUSB API: {caps.usbAPI?'mavjud':'mavjud emas'}.</p><button disabled>Elektron tarozi — qurilma adapteri ulanmagan</button><button disabled>ESC/POS / kassa tortmasi — bridge ulanmagan</button><p>Bank terminali: qo‘lda tasdiqlash. Fiskal provider ulanmagan. Soxta QR yaratilmaydi.</p><button disabled={!store.hasPermission('settingsWrite')} onClick={()=>{setConfigError('');setModal('scale')}}>Tarozi barcode sxemasi</button></div></Modal>
  <Modal open={modal==='scale'} onClose={()=>setModal('hardware')} title="Tarozi yorlig‘i dekoderi" subtitle="Faqat qurilmangizga mos aniq sxemani kiriting. [] — o‘chirilgan." footer={<button className="pro-btn primary" onClick={saveSchemes}>Tekshirish va saqlash</button>}><p>Mahsulot kodi katalogdagi aniq barcode bilan teng bo‘lishi kerak. EAN-13 checksum majburiy. Oddiy barcode avval tekshiriladi.</p><pre>{'[ { "prefix":"21", "productStart":2, "productLength":5, "valueStart":7, "valueLength":5, "divisor":1000, "unit":"kg", "encoding":"weight" } ]'}</pre><textarea aria-label="Tarozi sxemasi JSON" rows={8} value={schemeText} onChange={e=>setSchemeText(e.target.value)}/>{configError&&<p role="alert">{configError}</p>}</Modal>
  <BarcodeScannerModal open={camera} onClose={()=>setCamera(false)} onDetected={code=>{setCamera(false);enqueue(code)}}/>
  <Receipt sale={session.receipt} options={options} onClose={()=>{session.setReceipt(null);barcodeRef.current?.focus()}}/>
 </div>;
}
