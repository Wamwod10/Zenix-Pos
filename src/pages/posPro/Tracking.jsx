import {useState} from 'react';
import Modal from '../../components/Modal';
import {availableSerials,validateSerialChoice} from './serialSelection';
import {allocateTrackedStock} from '../../utils/stockTracking';
export default function Tracking({line,storeId,onSave,onClose}){
 const [ids,setIds]=useState(()=>(line.tracking?.serials||[]).map(s=>String(s.id??s))),[error,setError]=useState('');
 const serials=availableSerials(line,storeId),allocation=allocateTrackedStock(line,storeId,line.cartQty,{selection:{...line.tracking,serials:ids.map(id=>({id}))}});
 const save=()=>{try{const selection={...line.tracking,serials:ids.map(id=>({id}))};validateSerialChoice({...line,tracking:selection},storeId);if(!allocation.success)throw Error(allocation.message);onSave(selection);onClose()}catch(e){setError(e.message)}};
 return <Modal open title="Serial va partiya" subtitle={`${line.name} · ${line.cartQty} ${line.unit||'dona'}`} onClose={onClose} footer={<button className="pro-btn primary" onClick={save}>Tanlovni saqlash</button>}>
  <div className="pp-tracking"><p>Jismonan berilayotgan mahsulotning Serial / IMEI raqamini tanlang.</p>{serials.map(s=><label key={s.id} className="pp-confirm"><input type="checkbox" checked={ids.includes(String(s.id))} onChange={e=>setIds(v=>e.target.checked?[...v,String(s.id)]:v.filter(id=>id!==String(s.id)))}/>{s.serial}</label>)}
  {!serials.length&&<p>Serial hisobi mavjud emas.</p>}<h3>Partiya · FEFO</h3>{allocation.tracking?.batches?.length?allocation.tracking.batches.map(b=><p key={b.batchId}><strong>{b.batchNo||b.batchId}</strong> · {b.quantity} {line.unit} · {b.expiryDate||'Muddatsiz'}</p>):<p>Partiya hisobi mavjud emas.</p>}{error&&<p role="alert" className="pp-error">{error}</p>}</div>
 </Modal>;
}
