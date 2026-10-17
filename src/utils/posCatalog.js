// A bounded detail cache is never a complete inventory snapshot.
export function createPosCatalog({request,normalize,onChange=()=>{},maxEntries=600}){
 let stopped=false,sequence=0,searchGeneration=0,query={},results=[],categories=[],hasMore=false,nextCursor=null;
 const cache=new Map(),versions=new Map(),pending=new Map();let pinned=new Set(),resolvedPins=[];
 const snapshot=()=>({products:[...cache.values()],results:results.map(id=>cache.get(id)).filter(Boolean),categories,hasMore,nextCursor});
 const publish=()=>{if(!stopped)onChange(snapshot())};
 const trim=()=>{const keep=new Set([...pinned,...results,...resolvedPins]);for(const id of cache.keys())if(cache.size>maxEntries&&!keep.has(id)){cache.delete(id);versions.delete(id)}};
 const merge=(rows,version)=>{for(const row of rows){if(version<(versions.get(row.id)||0))continue;cache.set(row.id,normalize(row));versions.set(row.id,version)}};
 const resolve=ids=>{
  if(stopped)return Promise.reject(new Error('Catalog scope changed'));
  const unique=[...new Set(ids.map(String))].sort();if(!unique.length)return Promise.resolve({products:[],missingIds:[]});
  if(unique.length>250)return Promise.reject(new Error('Too many cart products'));
  resolvedPins=[...new Set([...resolvedPins,...unique])].slice(-250);
  const key=unique.join(',');if(pending.has(key))return pending.get(key);
  const version=++sequence;
  const work=(async()=>{
   const found=[],missing=[];
   for(let start=0;start<unique.length;start+=100){
    const page=await request({ids:unique.slice(start,start+100).join(',')});
    if(stopped)throw new Error('Catalog scope changed');
    if(!Array.isArray(page.products)||!Array.isArray(page.missingIds))throw new Error('Incomplete product resolution');
    const requested=unique.slice(start,start+100),covered=new Set([...page.products.map(p=>p.id),...page.missingIds]);
    if(requested.some(id=>!covered.has(id)))throw new Error('Incomplete product resolution');
    merge(page.products,version);found.push(...page.products);missing.push(...page.missingIds);
   }
   for(const id of missing)if(version>=(versions.get(id)||0)){cache.delete(id);versions.set(id,version)}
   trim();publish();return {products:found.map(normalize),missingIds:missing};
  })();pending.set(key,work);void work.finally(()=>pending.delete(key)).catch(()=>{});return work;
 };
 const search=async(input={},append=false)=>{
  if(stopped)return null;
  if(append&&(!hasMore||pending.has('page')))return null;
  const generation=append?searchGeneration:++searchGeneration,version=++sequence;
  if(!append)query={...input};
  const work=request({...query,...(append?{cursor:nextCursor}:{}),limit:40});
  if(append)pending.set('page',work);
  try{
   const page=await work;if(stopped||generation!==searchGeneration)return null;
   merge(page.products,version);results=[...new Set([...(append?results:[]),...page.products.map(p=>p.id)])].slice(-200);
   categories=page.categories||categories;hasMore=Boolean(page.hasMore);nextCursor=page.nextCursor||null;trim();publish();return snapshot();
  }finally{if(pending.get('page')===work)pending.delete('page')}
 };
 const barcode=async code=>{
  const version=++sequence,page=await request({barcode:code});
  if(stopped)throw new Error('Catalog scope changed');
  if(page.products?.length===0){const error=new Error('Shtrix-kod bo‘yicha mahsulot topilmadi');error.code='BARCODE_NOT_FOUND';throw error;}
  if(page.products?.length!==1)throw new Error('Shtrix-kod natijasi aniq emas');
  const row=page.products[0];resolvedPins=[...new Set([...resolvedPins,row.id])].slice(-250);
  merge([row],version);trim();publish();return normalize(row);
 };
 return {snapshot,resolve,search,barcode,cancelSearch:()=>{searchGeneration++},pin:ids=>{pinned=new Set(ids.map(String));trim()},dispose:()=>{stopped=true;searchGeneration++}};
}
