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
