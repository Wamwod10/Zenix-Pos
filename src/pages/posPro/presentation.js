// Display aliases only: never convert quantities, prices or authoritative stock.
const units={kg:'kg',kilogram:'kg',kilogramm:'kg','кг':'kg',g:'g',gr:'g',gram:'g',gramm:'g','г':'g',l:'l',litr:'l',liter:'l',litre:'l',ml:'ml',dona:'dona',ta:'dona',pcs:'dona',piece:'dona','шт':'dona'};
const quantityFormatter=new Intl.NumberFormat('en-US',{maximumFractionDigits:3});
export const displayUnit=unit=>{const text=String(unit||'').trim();return units[text.toLowerCase()]||text||'birlik'};
export const formatQuantity=value=>quantityFormatter.format(Number(value)).replaceAll(',',' ');
export function formatStock(value,unit){
 if(value===undefined||value===null||!Number.isFinite(Number(value)))return 'Qoldiq tekshirilmagan';
 return Number(value)<=0?'Qoldiq tugagan':`${formatQuantity(value)} ${displayUnit(unit)} mavjud`;
}
