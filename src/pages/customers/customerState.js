export function buildCustomerPaymentPayload({ amount, paymentMethod, note = "", storeId = null,clientReference }) {
  return { amount:Number(amount), paymentMethod, note, storeId:storeId || null,...(clientReference?{clientReference}:{}) };
}

export function appendCustomerHistory(detail,key,page){
 const rows=new Map((detail[key]||[]).map(row=>[row.id,row]));
 for(const row of page.items)rows.set(row.id,row);
 return {...detail,[key]:[...rows.values()],pages:{...detail.pages,[key]:page}};
}

export function resolveCustomerLoadResults(listResult, statsResult) {
  const list = listResult.status === "fulfilled"
    ? { customers:listResult.value?.items || [], total:Number(listResult.value?.total || 0) }
    : null;
  return {
    list,
    listError:listResult.status === "rejected" ? (listResult.reason?.message || "Mijozlarni yuklab bo‘lmadi") : "",
    stats:statsResult.status === "fulfilled" ? (statsResult.value || {}) : null,
    statsError:statsResult.status === "rejected" ? (statsResult.reason?.message || "Moliyaviy ko‘rsatkichlarni yuklab bo‘lmadi") : "",
  };
}
