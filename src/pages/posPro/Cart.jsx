import {memo,useState,useRef,useCallback} from 'react';
import {lineAmount} from '../../utils/posMoney';
import {finalUnitPrice,quantityStep,formatProMoney as formatPrice} from './model';
const CartLine=memo(function CartLine({line,index,cartPct,locked,canDiscount,onQuantity,onDiscount,onRemove}){
 const [qty,setQty]=useState(null),[discount,setDiscount]=useState(null);
 const step=quantityStep(line.unit);
 const commitQty=()=>{if(qty!==null){onQuantity(line.id,qty);setQty(null)}};
 const commitDiscount=()=>{if(discount!==null){onDiscount(line.id,discount);setDiscount(null)}};
 return <article className="pp-cart-line" data-product-id={line.id}>
  <span className="pp-line-index">{index+1}</span><div className="pp-line-name"><strong>{line.name}</strong><small>{line.barcode||line.sku||'—'} · {formatPrice(line.sellPrice)} / {line.unit||'dona'}</small></div>
  <div className="pp-quantity"><button aria-label={`${line.name} miqdorini kamaytirish`} title={`−${step} ${line.unit||'dona'}`} disabled={locked||line.cartQty<=step} onClick={()=>onQuantity(line.id,Math.round((line.cartQty-step)*1000)/1000)}>−</button><input aria-label={`${line.name} miqdori`} type="number" min="0.001" step="0.001" value={qty??line.cartQty} disabled={locked} onChange={e=>setQty(e.target.value)} onBlur={commitQty} onKeyDown={e=>{if(e.key==='Enter'){commitQty();e.currentTarget.blur()}}}/><button aria-label={`${line.name} miqdorini oshirish`} title={`+${step} ${line.unit||'dona'}`} disabled={locked} onClick={()=>onQuantity(line.id,Math.round((line.cartQty+step)*1000)/1000)}>+</button><small>{line.unit||'dona'}</small></div>
  <label className="pp-line-discount"><input aria-label={`${line.name} chegirma`} type="number" min="0" max="100" value={discount??line.discountPercent??0} disabled={locked||!canDiscount} onChange={e=>setDiscount(e.target.value)} onBlur={commitDiscount}/>%</label><strong className="pp-line-total">{formatPrice(lineAmount(line.cartQty,finalUnitPrice(line,cartPct)))}</strong><button className="pp-remove" aria-label={`${line.name} olib tashlash`} disabled={locked} onClick={()=>onRemove(line.id)}>×</button>
 </article>;
});
// Catalog typing and clock ticks must not traverse all 500 receipt lines.
const CartLines=memo(function CartLines({cart,cartPct,locked,canDiscount,quantity,discount,remove}){
 return <div className="pp-cart-lines">{cart.length?cart.map((line,i)=><CartLine key={line.id} line={line} index={i} cartPct={cartPct} locked={locked} canDiscount={canDiscount} onQuantity={quantity} onDiscount={discount} onRemove={remove}/>):<div className="pp-empty"><strong>Yangi chek</strong><p>Barcode skanerlang yoki katalogdan mahsulot tanlang.</p><small>USB / Bluetooth HID · Enter suffix</small></div>}</div>;
});
export default function Cart({session,canDiscount,onRemove}){
 const latest=useRef(null);latest.current={session,onRemove};
 const quantity=useCallback((...args)=>latest.current.session.quantity(...args),[]),discount=useCallback((...args)=>latest.current.session.discount(...args),[]),remove=useCallback(id=>latest.current.onRemove(id),[]);
 return <section className="pp-cart pp-panel" aria-label="Joriy chek"><div className="pp-panel-head"><h2>Joriy chek</h2><span>{session.cart.length} qator</span></div><div className="pp-cart-heading"><span>Mahsulot</span><span>Miqdor</span><span>%</span><span>Summa</span></div><CartLines cart={session.cart} cartPct={session.cartPct} locked={session.locked} canDiscount={canDiscount} quantity={quantity} discount={discount} remove={remove}/></section>;
}
