/** Never turn a name/SKU query into a barcode lookup or guess among results. */
export function selectSearchResult(products,query,activeId){
 if(!String(query).trim())return null;
 const available=products.filter(p=>!p.archived&&Number(p.quantity)>0);
 if(activeId)return available.find(p=>p.id===activeId)||null;
 const exact=available.filter(p=>String(p.sku||'').toLowerCase()===query.trim().toLowerCase());
 if(exact.length)return exact.length===1?exact[0]:null;
 return available.length===1?available[0]:null;
}
