import Modal from '../../components/Modal';
import {receiptHtml,printReceipt} from './receiptFormat';
export {receiptHtml,printReceipt} from './receiptFormat';
export default function Receipt({sale,onClose,options,onPrintError}){
 return <Modal open={Boolean(sale)} onClose={onClose} title="Savdo tasdiqlandi" subtitle="Server savdoni saqladi. Navbatdagi chek tayyor." footer={<><button className="pro-btn secondary" onClick={onClose}>Yangi chek</button><button className="pro-btn primary" onClick={()=>printReceipt(sale,options,onPrintError)}>Chek chiqarish · F10</button></>}>
  {sale&&<iframe className="pp-receipt-preview" title="Tasdiqlangan chek" sandbox="" srcDoc={receiptHtml(sale,options)}/>}
 </Modal>;
}
