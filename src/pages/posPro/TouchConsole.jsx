import {useEffect,useState} from 'react';
import {FiDelete,FiSearch,FiMaximize,FiCheck} from 'react-icons/fi';
import {touchKey,priceDiscount} from './touchInput';
import {finalUnitPrice,formatProMoney as formatPrice,validateQuantity} from './model';

export default function TouchConsole({line,cartPct,locked,canDiscount,onQuantity,onDiscount,onSearch,onBarcode}){
 const [field,setField]=useState('quantity'),[value,setValue]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setValue('');setError('')},[line?.id,field]);
 const current=field==='quantity'?line?.cartQty:field==='discount'?line?.discountPercent:line?finalUnitPrice(line,cartPct):0;
 const apply=()=>{
  if(locked||!line||value==='')return;
  try{
   const n=Number(value);if(!Number.isFinite(n))throw Error('To‘g‘ri qiymat kiriting');
   if(field==='quantity')onQuantity(line.id,validateQuantity(value));
   else if(field==='price')onDiscount(line.id,priceDiscount(line.sellPrice,n,cartPct));
   else onDiscount(line.id,n);
   setValue('');setError('');
  }catch(e){setError(e.message)}
 };
 const disabled=locked||!line||(field!=='quantity'&&!canDiscount);
 return <section className="pp-touch-console pp-panel" aria-label="Sensorli klaviatura">
  <div className="pp-touch-fields" role="group" aria-label="Tahrirlash maydoni">{[['quantity','Miqdor'],['price','Narx'],['discount','Chegirma']].map(([key,label])=><button key={key} aria-pressed={field===key} disabled={key!=='quantity'&&!canDiscount} onClick={()=>setField(key)}>{label}</button>)}</div>
  <div className="pp-touch-selection"><strong>{line?.name||'Mahsulot tanlang'}</strong><small>{field==='price'?'Birlik narxi · chegirma limiti doirasida':field==='discount'?'Qator chegirmasi, %':'Tanlangan mahsulot miqdori'}</small></div>
  <output className="pp-touch-value" aria-label="Klaviatura qiymati" aria-live="polite">{value||String(current??'0')}{field==='discount'?' %':''}</output>
  <div className="pp-touch-keypad">{['1','2','3','backspace','4','5','6','00','7','8','9','.','clear','0','enter'].map(key=><button key={key} className={key==='enter'?'pp-touch-enter':''} aria-label={key==='backspace'?'Oxirgi raqamni o‘chirish':key==='clear'?'Qiymatni tozalash':key==='enter'?'Qiymatni qo‘llash':`Raqam ${key}`} disabled={disabled} onClick={()=>key==='enter'?apply():setValue(v=>touchKey(v,key))}>{key==='backspace'?<FiDelete/>:key==='clear'?'C':key==='enter'?<><FiCheck/> Enter</>:key}</button>)}</div>
  {error&&<p className="pp-error" role="alert">{error}</p>}
  <div className="pp-touch-quick"><button onClick={onSearch}><FiSearch/> Qidirish</button><button onClick={onBarcode}><FiMaximize/> Barcode</button></div>
  {line&&<small className="pp-touch-price-note">Birlik narxi: {formatPrice(finalUnitPrice(line,cartPct))}</small>}
 </section>;
}
