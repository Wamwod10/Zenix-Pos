export const hasPendingBillingPayment = (payments, organizationId) => (payments || []).some((payment) => (
  payment.status === "REVIEW" && (!organizationId || String(payment.organizationId) === String(organizationId))
));

export const startBillingPaymentPolling = (reloadStore, scheduler = globalThis) => {
  const timer = scheduler.setInterval(() => reloadStore(), 8000);
  return () => scheduler.clearInterval(timer);
};
