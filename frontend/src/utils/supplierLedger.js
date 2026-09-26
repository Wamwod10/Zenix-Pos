export const invoiceBalance = (row) => {
  if (row?.balance != null) return Math.max(0, Number(row.balance || 0));
  if (["credit", "partial"].includes(row?.paymentStatus)) {
    return Math.max(0, Number(row.total || 0) - Number(row.paidAmount || 0));
  }
  return 0;
};

export const invoiceStatus = (row) => {
  const balance = invoiceBalance(row);
  if (balance <= 0) return "paid";
  return Number(row?.paidAmount || 0) > 0 ? "partial" : "credit";
};

export const supplierOpenDebt = (supplier) => {
  const purchaseHistory = Array.isArray(supplier?.purchaseHistory) ? supplier.purchaseHistory : [];
  const ledgerDebt = purchaseHistory.reduce((sum, row) => sum + invoiceBalance(row), 0);
  const legacyDebt = Math.max(0, Number(supplier?.debt || 0));
  // Nakladnoy ledger mavjud bo‘lsa u yagona source of truth hisoblanadi.
  // `debt` faqat eski workspace yozuvlari uchun fallback sifatida qoladi.
  return purchaseHistory.length ? ledgerDebt : legacyDebt;
};
