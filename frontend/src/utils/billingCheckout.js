export const createCheckoutDraft = ({
  source = "plan",
  order,
  currentPlan = "",
  currentEndDate = "",
  selectedEndDate = "",
  durationDays = 0,
  baseTariffAmount = order?.baseAmount || 0,
  additionalBranchCount = order?.renewalExtraStores || 0,
  additionalBranchCost = order?.extraStoreAmount || 0,
  totalAmount = order?.amount || 0,
  metadata = {},
} = {}) => {
  if (!order) return null;
  return {
    id: order.orderId || order.id,
    source,
    order: { ...order },
    plan: order.plan || currentPlan,
    currentPlan,
    currentEndDate,
    selectedEndDate,
    durationDays:Number(durationDays || order.extensionDays || 0),
    baseTariffAmount:Number(baseTariffAmount || 0),
    additionalBranchCount:Number(additionalBranchCount || 0),
    additionalBranchCost:Number(additionalBranchCost || 0),
    totalAmount:Number(totalAmount || 0),
    metadata:{ ...metadata, createdAt:new Date().toISOString() },
  };
};
