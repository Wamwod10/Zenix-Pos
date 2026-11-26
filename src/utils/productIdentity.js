// Product identity is ID/barcode/SKU, never the display name.
import {isBarcodeDuplicate} from './barcode.js';
const clean=value=>String(value??'').trim();
const skuKey=value=>clean(value).toLowerCase();
export const isSkuDuplicate=(items,sku,exceptId)=>Boolean(skuKey(sku)&&items.some(p=>String(p.id)!==String(exceptId)&&skuKey(p.sku)===skuKey(sku)));
export function matchReceiptProduct(items,{barcode,sku}){
 const code=clean(barcode),key=skuKey(sku);
 // A supplied barcode is authoritative; never fall back to name or another SKU.
 const found=code?items.find(p=>clean(p.barcode)===code):key?items.find(p=>skuKey(p.sku)===key):null;
 return found&&!found.archived&&(!key||skuKey(found.sku)===key)?found:null;
}
export function validateReceiptIdentities(rows,inventory){
 const ids=new Set(),codes=new Set(),skus=new Set();
 for(const row of rows){
  const id=clean(row.productId),code=clean(row.barcode),sku=skuKey(row.sku);
  if(id){if(ids.has(id))throw Error('Bir mahsulot ikki marta kiritilgan. Miqdorini bitta qatorda birlashtiring.');ids.add(id);continue;}
  if(code&&(codes.has(code)||isBarcodeDuplicate(inventory,code)))throw Error((row.name||code)+': shtrix-kod band. Yangi kod yarating yoki mavjud mahsulotni tanlang.');
  if(sku&&(skus.has(sku)||isSkuDuplicate(inventory,sku)))throw Error((row.name||sku)+': SKU band. Yangi shtrix-kod yarating yoki SKU ni o‘zgartiring.');
  if(code)codes.add(code);if(sku)skus.add(sku);
 }
}
export async function prepareReceiptIdentities(rows,inventory,generateBarcode){
 validateReceiptIdentities(rows,inventory);
 const reserved=new Set([...inventory,...rows].map(p=>clean(p.barcode)).filter(Boolean));
 const skus=new Set([...inventory,...rows].map(p=>skuKey(p.sku)).filter(Boolean));
 const prepared=[];
 for(const row of rows){
  if(row.productId){prepared.push({...row});continue}
  let barcode=clean(row.barcode),sku=clean(row.sku);
  if(!barcode){
   for(let attempt=0;attempt<8;attempt++){
    const result=await generateBarcode({reserved:[...reserved]});
    if(!result?.success)throw Error(result?.message||'Shtrix-kod yaratib bo‘lmadi.');
    const candidate=clean(result.barcode);
    if(candidate&&!reserved.has(candidate)&&!skus.has(skuKey('BC-'+candidate))){barcode=candidate;break}
   }
   if(!barcode)throw Error('Unikal shtrix-kod yaratib bo‘lmadi. Qayta urining.');
  }
  if(!sku){sku='BC-'+barcode;if(skus.has(skuKey(sku)))throw Error((row.name||barcode)+': SKU band. Yangi shtrix-kod yarating.');}
  reserved.add(barcode);skus.add(skuKey(sku));prepared.push({...row,barcode,sku,createNew:true});
 }
 validateReceiptIdentities(prepared,inventory);
 return prepared;
}
