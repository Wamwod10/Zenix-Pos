export function buildCustomerPaymentPayload({ amount, paymentMethod, note = "", storeId = null }) {
  return { amount:Number(amount), paymentMethod, note, storeId:storeId || null };
}

export function resolveCustomerLoadResults(listResult, statsResult) {
  const list = listResult.status === "fulfilled"
    ? { customers:listResult.value?.customers || [], total:Number(listResult.value?.total || 0) }
    : null;
  return {
    list,
    listError:listResult.status === "rejected" ? (listResult.reason?.message || "Mijozlarni yuklab bo‘lmadi") : "",
    stats:statsResult.status === "fulfilled" ? (statsResult.value || {}) : null,
    statsError:statsResult.status === "rejected" ? (statsResult.reason?.message || "Moliyaviy ko‘rsatkichlarni yuklab bo‘lmadi") : "",
  };
}
