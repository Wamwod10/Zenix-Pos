// Rebuilt with the inventory snapshot, never shared between workspaces.
export function createPosCatalogSearch(products) {
  return products.filter(product=>!product.archived).map(product=>({
    product,
    text:`${product.name} ${product.sku||''} ${product.barcode||''}`.toLowerCase(),
  }));
}

export function searchPosCatalog(index,search,category) {
  const query=search.toLowerCase();
  const matches=[];
  for(const {product,text} of index){
    if((category==='all'||product.category===category)&&text.includes(query))matches.push(product);
  }
  return matches;
}
