const yieldToBrowser=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));

// Build privately and publish once: checkout never sees an incomplete catalog.
export async function mapBootstrapInventory(source,normalize,{isCurrent=()=>true,yieldControl=yieldToBrowser,chunkSize=5000,budgetMs=8,onChunk}={}){
 const rows=source||[];
 if(!Array.isArray(rows))throw new Error('Invalid bootstrap inventory');
 const result=new Array(rows.length);
 if(!Number.isInteger(chunkSize)||chunkSize<1)throw new Error('Invalid bootstrap inventory chunk size');
 for(let start=0;start<rows.length;){
  if(!isCurrent())return null;
  const end=Math.min(start+chunkSize,rows.length),began=performance.now();let i=start;
  for(;i<end;i++){
   result[i]=normalize(rows[i]);
   if((i-start+1)%250===0&&performance.now()-began>=budgetMs){i++;break;}
  }
  start=i;
  onChunk?.(performance.now()-began);
  if(start<rows.length)await yieldControl();
 }
 return isCurrent()?result:null;
}
export function transferConfirmation(transfer, stores = [], submitted = {}) {
 const count=Array.isArray(transfer?.items)?transfer.items.length:(Number.isInteger(submitted.itemCount) && submitted.itemCount>0?submitted.itemCount:null);
 const id=transfer?.to_store_id ?? transfer?.toStoreId ?? submitted.toStoreId;
 const name=stores.find(store=>String(store.id)===String(id))?.name;
 const parts=[];
 if(count!==null)parts.push(`${count} ta mahsulot`);
 if(typeof name==='string' && name.trim())parts.push(name.trim());
 return parts.length?parts.join(' · '):'Transfer yaratildi';
}
