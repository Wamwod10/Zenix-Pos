export const hasPendingBillingPayment = (payments, organizationId) => (payments || []).some((payment) => (
  payment.status === "REVIEW" && (!organizationId || String(payment.organizationId) === String(organizationId))
));

export const billingPaymentReviewState = (payments = [], organizationId) => {
  const latest = payments
    .filter((payment) => payment.type !== "EXTRA" && (!organizationId || String(payment.organizationId) === String(organizationId)))
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())[0];
  const status = String(latest?.status || "").toUpperCase();
  if (status === "REVIEW") return "waiting";
  if (status === "APPROVED" || status === "ACTIVE") return "approved";
  if (status === "REJECTED") return "rejected";
  return "idle";
};

export const startBillingPaymentPolling = (reloadStore, options = {}) => {
  const legacyScheduler = options?.setInterval ? options : null;
  const scheduler = legacyScheduler || options.scheduler || globalThis;
  const intervalMs = legacyScheduler ? 8000 : Number(options.intervalMs || 8000);
  let inFlight = false;
  const tick = () => {
    if (inFlight) return;
    inFlight = true;
    let reload;
    try {
      reload = reloadStore();
    } catch {
      inFlight = false;
      return;
    }
    Promise.resolve(reload)
      .catch(() => undefined)
      .finally(() => { inFlight = false; });
  };
  const timer = scheduler.setInterval(tick, intervalMs);
  return () => scheduler.clearInterval(timer);
};
