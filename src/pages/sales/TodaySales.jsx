import {useEffect,useState} from 'react';
import {api} from '../../services/apiClient';
import {formatPrice} from '../../utils/formatPrice';
import {StatusBadge} from '../../components/Ui';
const paymentLabels={cash:'Naqd',card:'Karta',transfer:'O‘tkazma',split:'Aralash',credit:'Nasiya'};
export function TodaySaleCard({sale,canReturn,onReturn}){
 const items=sale.items||[],preview=items.slice(0,3),remaining=items.slice(3);
 const line=(item,index)=><div key={item.id||index}><strong>{item.name||'Mahsulot'}</strong><span> × {item.quantity} {item.unit||'dona'}{item.returnedQty>0?` · Qaytdi: ${item.returnedQty}`:''}</span></div>;
 return <article><div className="today-sale-top"><span><strong>Chek #{sale.saleNumber}</strong><small>{sale.date} {sale.time} · {sale.sellerName||'Kassir'}</small></span><strong>{formatPrice(sale.netTotal)}</strong></div>
  <div className="today-sale-products">{preview.map(line)}{remaining.length>0&&<details><summary>Yana {remaining.length} mahsulot</summary>{remaining.map(line)}</details>}</div>
  <div className="today-sale-amounts"><span>Original: {formatPrice(sale.originalTotal)}</span><span>Qaytarilgan: {formatPrice(sale.returnedTotal)}</span><strong>Sof: {formatPrice(sale.netTotal)}</strong></div>
  <div className="today-sale-meta"><StatusBadge tone="info">{paymentLabels[sale.paymentMethod]||sale.paymentMethod}</StatusBadge><StatusBadge tone={sale.returnStatus==='none'?'success':'warning'}>{sale.returnStatus==='returned'?'To‘liq qaytarilgan':sale.returnStatus==='partial_returned'?'Qisman qaytarilgan':'Qaytarilmagan'}</StatusBadge>{canReturn&&sale.returnStatus!=='returned'&&<button className="pro-btn secondary today-sale-return" onClick={()=>onReturn(sale)}>Qaytarish</button>}</div></article>;
}
export default function TodaySales({storeId,canReturn,onReturn}){
 const [page,setPage]=useState(0),[items,setItems]=useState([]),[more,setMore]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setBusy(true);setError('');
  api.get(`/api/sales/page?${new URLSearchParams({storeId,limit:'30',offset:String(page*30)})}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setItems(data.items||[]);setMore(Boolean(data.hasMore))}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return()=>controller.abort();
 },[storeId,page,retry]);
 return <div className="today-sales-modal">{busy?<div className="pro-empty" role="status">Savdolar yuklanmoqda...</div>:error?<div className="pro-alert danger" role="alert">{error}<button className="pro-btn secondary" onClick={()=>setRetry(value=>value+1)}>Qayta urinish</button></div>:items.length?<div className="today-sales-list">{items.map(sale=><TodaySaleCard key={sale.id} sale={sale} canReturn={canReturn} onReturn={onReturn}/>)}</div>:<div className="pro-empty">Bugun hali savdo yo‘q</div>}
 <div className="platform-pagination"><button className="pro-btn secondary" disabled={busy||page===0} onClick={()=>setPage(value=>value-1)}>Oldingi</button><span>{page+1} sahifa</span><button className="pro-btn secondary" disabled={busy||!!error||!more} onClick={()=>setPage(value=>value+1)}>Keyingi</button></div></div>;
}
