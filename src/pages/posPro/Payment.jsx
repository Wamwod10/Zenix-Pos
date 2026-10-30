import {useEffect,useState} from 'react';
import Modal from '../../components/Modal';
import {PremiumDateInput} from '../../components/Ui';
import {paymentPlan,formatProMoney as formatPrice} from './model';
export const paymentLabels={cash:'Naqd',card:'Karta',transfer:'O‘tkazma',split:'Aralash',credit:'Nasiya'};
export default function Payment({method,total,customerId,creditAllowed,todayISO,busy,error,onClose,onConfirm}){
 const [tendered,setTendered]=useState(''),[card,setCard]=useState(''),[transfer,setTransfer]=useState(''),[dueDate,setDueDate]=useState(''),[externalConfirmed,setConfirmed]=useState(false),[reviewed,setReviewed]=useState(false);
 // If server-side catalog reconciliation changes the total, prior payment acknowledgement is stale.
 useEffect(()=>{setReviewed(false);setConfirmed(false)},[total,method,customerId,todayISO]);
 const input={method,total,tendered,card:method==='split'?card:0,transfer:method==='split'?transfer:0,dueDate,externalConfirmed,customerId,creditAllowed,todayISO};
 let plan,validation='';try{plan=paymentPlan(input)}catch(e){validation=e.message}
 const edit=setter=>event=>{if(busy)return;setter(event.target.value);setConfirmed(false);setReviewed(false)};
 const changeTendered=next=>{if(busy)return;setTendered(next);setConfirmed(false);setReviewed(false)};
 const cashNeeded=method==='split'?Math.max(0,total-Number(card||0)-Number(transfer||0)):method==='cash'?total:0;
 const external=method==='card'||method==='transfer'||method==='split'&&(Number(card)>0||Number(transfer)>0);
 return <Modal open onClose={()=>!busy&&onClose()} title={`To‘lov — ${paymentLabels[method]}`} subtitle="Summalarni tekshiring va yakunlashni alohida tasdiqlang." closeOnBackdrop={false} footer={<><button className="pro-btn secondary" disabled={busy} onClick={onClose}>Orqaga · Esc</button><button className="pro-btn primary" disabled={busy||!plan||!reviewed} onClick={()=>onConfirm(input)}>{busy?'Server tasdig‘i kutilmoqda…':'Tasdiqlab yakunlash'}</button></>}>
  <div className="pp-payment"><div className="pp-payment-total">{formatPrice(total)}</div>
  {method==='split'&&<div className="pp-payment-fields"><label>Karta<input aria-label="Karta summasi" disabled={busy} type="number" min="0" step="0.01" value={card} onChange={edit(setCard)}/></label><label>O‘tkazma<input aria-label="O‘tkazma summasi" disabled={busy} type="number" min="0" step="0.01" value={transfer} onChange={edit(setTransfer)}/></label><p>Naqd qismi: <b>{formatPrice(cashNeeded)}</b></p></div>}
  {['cash','split','credit'].includes(method)&&<><label className="pp-field">{method==='credit'?'Boshlang‘ich naqd to‘lov':'Mijoz bergan naqd'}<input aria-label="Mijoz bergan naqd" disabled={busy} type="number" inputMode="decimal" min="0" step="0.01" value={tendered} onChange={edit(setTendered)}/></label><div className="pp-quick-money"><button type="button" disabled={busy} onClick={()=>changeTendered(String(cashNeeded))}>Aniq summa</button>{[10000,50000,100000].map(n=><button key={n} type="button" disabled={busy} onClick={()=>changeTendered(String(Number(tendered||0)+n))}>+{formatPrice(n)}</button>)}<button type="button" disabled={busy} onClick={()=>changeTendered('')}>Tozalash</button></div><p className="pp-change">Qaytim <strong>{formatPrice(plan?.change||0)}</strong></p></>}
  {method==='credit'&&<label className="pp-field">Nasiya muddati<PremiumDateInput aria-label="Nasiya muddati" disabled={busy} min={todayISO||""} value={dueDate} onChange={edit(setDueDate)}/></label>}
  {external&&<label className="pp-confirm"><input type="checkbox" disabled={busy} checked={externalConfirmed} onChange={e=>{setConfirmed(e.target.checked);setReviewed(false)}}/> Bank terminali / o‘tkazma muvaffaqiyatini tekshirdim. Qo‘lda tasdiqlayman. Avtomatik bank integratsiyasi ulanmagan.</label>}
  {validation&&<p className="pp-warning" role="status">{validation}</p>}{error&&<p className="pp-error" role="alert">{error}</p>}
  <label className="pp-confirm"><input type="checkbox" checked={reviewed} disabled={!plan||busy} onChange={e=>setReviewed(e.target.checked)}/> Chek va to‘lov summasini tekshirdim. Savdoni yakunlash.</label></div>
 </Modal>;
}
