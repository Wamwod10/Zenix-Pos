import {allocateTrackedStock} from '../../utils/stockTracking.js';
export const availableSerials=(line,storeId)=>(line.serializedUnits||[]).filter(s=>String(s.storeId)===String(storeId)&&(s.status||'IN_STOCK')==='IN_STOCK');
export function validateSerialChoice(line,storeId){
 const serials=availableSerials(line,storeId);
 if(!serials.length)return;
 const selected=line.tracking?.serials||[];
 if(!Number.isInteger(Number(line.cartQty))||selected.length!==Math.min(Number(line.cartQty),serials.length))throw Error(`${line.name}: Serial / IMEI birliklarini tanlang`);
 const result=allocateTrackedStock(line,storeId,line.cartQty,{selection:line.tracking});
 if(!result.success)throw Error(result.message);
}
