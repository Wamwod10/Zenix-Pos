export async function loadScopedReport(request,options,{signal,allPages=false}={}){
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(options))if(value!==null&&value!==undefined&&value!==''&&value!=='all')query.set(key,String(value));
  query.set('limit',String(options.limit||500));
  let result=await request(`/api/finance?${query}`,{signal});
  if(!allPages)return result;
  const sales=[...result.sales],returns=[...result.returns],expenses=[...(result.expenses||[])];
  while(result.pagination.hasMore){
    query.set('offset',String(result.pagination.offset+result.pagination.limit));
    result=await request(`/api/finance?${query}`,{signal});
    sales.push(...result.sales);returns.push(...result.returns);expenses.push(...(result.expenses||[]));
  }
  return {...result,sales:[...new Map(sales.map(row=>[row.id,row])).values()],returns:[...new Map(returns.map(row=>[row.id,row])).values()],expenses:[...new Map(expenses.map(row=>[row.id,row])).values()]};
}
