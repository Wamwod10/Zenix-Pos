import {FiTrash2,FiPackage,FiPlus,FiArrowRight,FiShoppingBag} from 'react-icons/fi';
import {displayUnit,formatQuantity} from './presentation';
import {memo,useState,useRef,useCallback} from 'react';
import {lineAmount} from '../../utils/posMoney';
import {finalUnitPrice,quantityStep,formatProMoney as formatPrice} from './model';
const CartLine=memo(function CartLine({line,index,cartPct,locked,canDiscount,onQuantity,onDiscount,onRemove,onTracking}){
 const [qty,setQty]=useState(null),[discount,setDiscount]=useState(null);
 const step=quantityStep(line.unit);
 const commitQty=()=>{if(qty!==null){onQuantity(line.id,qty);setQty(null)}};
 const commitDiscount=()=>{if(discount!==null){onDiscount(line.id,discount);setDiscount(null)}};
 return <article className="pp-cart-line" data-product-id={line.id}>
  <span className="pp-line-index">{index+1}</span><div className="pp-line-name"><strong>{line.name}</strong><small>{formatPrice(line.sellPrice)} / {displayUnit(line.unit)} · {line.barcode||line.sku||'—'}</small>{((line.serializedUnits||[]).length>0||(line.stockBatches||[]).length>0)&&<button className="pp-tracking-link" disabled={locked} onClick={()=>onTracking(line.id)}><FiPackage/>{line.tracking?.serials?.length?`${line.tracking.serials.length} Serial tanlangan`:(line.serializedUnits||[]).length?'Serial tanlang':'Partiya · FEFO'}</button>}</div>
  <div className="pp-quantity"><button aria-label={`${line.name} miqdorini kamaytirish`} title={`−${step} ${displayUnit(line.unit)}`} disabled={locked||line.cartQty<=step} onClick={()=>onQuantity(line.id,Math.round((line.cartQty-step)*1000)/1000)}>−</button><input aria-label={`${line.name} miqdori`} type="number" min="0.001" step="0.001" value={qty??line.cartQty} disabled={locked} onChange={e=>setQty(e.target.value)} onBlur={commitQty} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/><button aria-label={`${line.name} miqdorini oshirish`} title={`+${step} ${displayUnit(line.unit)}`} disabled={locked} onClick={()=>onQuantity(line.id,Math.round((line.cartQty+step)*1000)/1000)}>+</button><small>{displayUnit(line.unit)}</small></div>
  <label className="pp-line-discount"><input aria-label={`${line.name} chegirma`} type="number" min="0" max="100" value={discount??line.discountPercent??0} disabled={locked||!canDiscount} onChange={e=>setDiscount(e.target.value)} onBlur={commitDiscount}/>%</label><strong className="pp-line-total">{formatPrice(lineAmount(line.cartQty,finalUnitPrice(line,cartPct)))}</strong><button className="pp-remove" aria-label={`${line.name} olib tashlash`} disabled={locked} onClick={()=>onRemove(line.id)}><FiTrash2/></button>
 </article>;
});
// Catalog typing and clock ticks must not traverse all 500 receipt lines.
const CartLines=memo(function CartLines({cart,cartPct,locked,canDiscount,quantity,discount,remove,tracking}){
 return <div className="pp-cart-lines">{cart.length?cart.map((line,i)=><CartLine key={line.id} line={line} index={i} cartPct={cartPct} locked={locked} canDiscount={canDiscount} onQuantity={quantity} onDiscount={discount} onRemove={remove} onTracking={tracking}/>):<div className="pp-empty"><strong>Yangi chek</strong><p>Barcode skanerlang yoki katalogdan mahsulot tanlang.</p><small>USB / Bluetooth HID · Enter suffix</small></div>}</div>;
});
export default function Cart({session,canDiscount,onRemove,onTracking,onScan,onSearch,operatorRail,shiftOpen=true}){
 const latest=useRef(null);latest.current={session,onRemove,onTracking};
 const quantity=useCallback((...args)=>latest.current.session.quantity(...args),[]),discount=useCallback((...args)=>latest.current.session.discount(...args),[]),remove=useCallback(id=>latest.current.onRemove(id),[]),tracking=useCallback(id=>latest.current.onTracking?.(id),[]);
 const last=session.cart.at(-1);
 return <section className="pp-cart pp-panel" aria-label="Joriy chek"><div className="pp-panel-head"><h2><FiShoppingBag/> Joriy chek</h2><span>{session.cart.length} qator{!shiftOpen&&session.cart.length>0?' · Draft — hali sotilmagan':''}</span></div><div className="pp-cart-heading"><span>Mahsulot / birlik narxi</span><span>Miqdor</span><span>%</span><span>Summa</span></div><CartLines cart={session.cart} cartPct={session.cartPct} locked={session.locked} canDiscount={canDiscount} quantity={quantity} discount={discount} remove={remove} tracking={tracking}/>{session.cart.length>0&&session.cart.length<=2&&<div className="pp-sparse"><div className="pp-sparse-context"><span>{last?'Chekdagi mahsulot':'Xaridor uchun yangi chek'}</span><strong>{last?last.name:'Birinchi mahsulotni qo‘shing'}</strong><small>{last?`${formatQuantity(last.cartQty)} ${displayUnit(last.unit)} · ${formatPrice(lineAmount(last.cartQty,finalUnitPrice(last,session.cartPct)))}`:'Barcode yoki nom / SKU orqali boshlang'}</small></div><div className="pp-sparse-actions"><button disabled={session.locked} onClick={onScan}><FiPlus/>Barcode <kbd>F3</kbd></button><button disabled={session.locked} onClick={onSearch}>Qidirish <FiArrowRight/><kbd>F2</kbd></button></div><p>Miqdorni tekshiring → To‘lov usulini tanlang → Tasdiqlang</p></div>}{operatorRail}</section>;
}
