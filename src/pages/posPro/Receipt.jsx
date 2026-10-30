import {useEffect,useState} from 'react';
import Modal from '../../components/Modal';
import {receiptHtml,printReceipt} from './receiptFormat';
export {receiptHtml,printReceipt} from './receiptFormat';
export default function Receipt({sale,onClose,options,onPrintError}){
 const [printError,setPrintError]=useState('');
 useEffect(()=>setPrintError(''),[sale?.id]);
 const reportPrintError=error=>{setPrintError(error?.message||'Printer oynasini ochib bo‘lmadi');onPrintError?.(error)};
 return <Modal open={Boolean(sale)} onClose={onClose} title="Savdo tasdiqlandi" subtitle="Server savdoni saqladi. Navbatdagi chek tayyor." footer={<><button className="pro-btn secondary" onClick={onClose}>Yangi chek</button><button className="pro-btn primary" onClick={()=>{setPrintError('');printReceipt(sale,options,reportPrintError)}}>Chek chiqarish · F10</button></>}>
  {printError&&<p role="alert" className="pp-error">{printError}</p>}
  {sale&&<iframe className="pp-receipt-preview" title="Tasdiqlangan chek" sandbox="" srcDoc={receiptHtml(sale,options)}/>}
 </Modal>;
}
