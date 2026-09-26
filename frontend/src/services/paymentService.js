import {
  BILLING_CONFIG, BILLING_PLANS, billingDaysBetween, priceExtraStoreExtension,
  pricePlanExtension,
} from "../config/billing.js";

const orderId = () => `ZX-${crypto.randomUUID().slice(0,10).toUpperCase()}`;

export const paymentService = {
  buildOrder({ type="LICENSE", intent="ACTIVATE", plan="ANNUAL", remainingDays=365, extraStores=1, renewalExtraStores=0, currentExpiry=null, targetExpiry=null }={}) {
    const selectedPlan=BILLING_PLANS[plan]||BILLING_PLANS.ANNUAL;
    const baseAmount=selectedPlan.amount;
    const renewalExtras=Math.max(0,Number(renewalExtraStores||0));
    const amount=type==="EXTRA"
      ? priceExtraStoreExtension(plan,remainingDays,Math.max(1,extraStores))
      : baseAmount+(plan==="MONTHLY"?BILLING_CONFIG.extraStore.monthlyAmount*renewalExtras:BILLING_CONFIG.extraStore.annualAmount*renewalExtras);
    const id=orderId();
    const purpose=type==="EXTRA"
      ? `Qo‘shimcha filial limiti · ${extraStores} ta`
      : `${selectedPlan.label} tarif${renewalExtras?` · ${renewalExtras} ta qo‘shimcha filial bilan`:""}`;
    return {
      id,orderId:id,type,intent,plan,amount,baseAmount:type==="EXTRA"?0:baseAmount,
      extraStoreAmount:type==="EXTRA"?amount:Math.max(0,amount-baseAmount),remainingDays,extraStores,renewalExtraStores:renewalExtras,
      currentExpiry,servicePeriodFrom:currentExpiry||null,servicePeriodTo:targetExpiry||null,targetExpiry:targetExpiry||null,
      purpose,status:"PENDING"
    };
  },

  buildRenewalOrder({plan="ANNUAL",currentExpiry,targetExpiry,renewalExtraStores=0}={}){
    const extensionDays=billingDaysBetween(currentExpiry,targetExpiry);
    const baseAmount=pricePlanExtension(plan,extensionDays);
    const extraStoreAmount=priceExtraStoreExtension(plan,extensionDays,renewalExtraStores);
    const amount=baseAmount+extraStoreAmount;
    const id=orderId();
    const selectedPlan=BILLING_PLANS[plan]||BILLING_PLANS.ANNUAL;
    return {
      id,orderId:id,type:"LICENSE",intent:"RENEW",plan,
      amount,baseAmount,extraStoreAmount,renewalExtraStores:Math.max(0,Number(renewalExtraStores||0)),
      currentExpiry,servicePeriodFrom:currentExpiry,servicePeriodTo:targetExpiry,targetExpiry,extensionDays,
      purpose:`${selectedPlan.label} tarifni ${targetExpiry} gacha uzaytirish`,status:"PENDING",
    };
  },
};
