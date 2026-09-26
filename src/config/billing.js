export const BILLING_CONFIG = {
  currency: "UZS",
  monthly: { amount: 350_000, months: 1, includedStores: 2, referenceDays: 30 },
  annual: { amount: 3_300_000, months: 12, includedStores: 2, saving: 900_000, referenceDays: 365 },
  extraStore: { annualAmount: 1_100_000, monthlyAmount: 120_000, months: 12 },
  manualPayment: {
    cardNumber: "9860 1766 1820 8142",
    cardHolder: "Shamshod Ochilov",
    purposePrefix: "Zenix POS tarifi",
  },
  receipt: {
    maxBytes: 5 * 1024 * 1024,
    accepted: ["image/jpeg", "image/png", "application/pdf"],
  },
};

export const BILLING_PLANS = {
  MONTHLY: { key: "MONTHLY", label: "Oylik", ...BILLING_CONFIG.monthly },
  ANNUAL: { key: "ANNUAL", label: "Yillik", ...BILLING_CONFIG.annual },
};

const DAY_MS=86_400_000;
const validDate=(value)=>{
  if(value instanceof Date)return Number.isFinite(value.getTime())?new Date(value):null;
  const raw=String(value||"").trim();
  const dateOnly=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(dateOnly){
    const [,year,month,day]=dateOnly;
    const date=new Date(Number(year),Number(month)-1,Number(day),12,0,0,0);
    return Number.isFinite(date.getTime())?date:null;
  }
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date:null;
};

export const billingDateISO=(value)=>{
  const date=validDate(value);
  if(!date)return "";
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

export const billingDaysBetween=(fromValue,toValue)=>{
  const from=validDate(fromValue),to=validDate(toValue);
  if(!from||!to)return 0;
  const fromDay=Date.UTC(from.getFullYear(),from.getMonth(),from.getDate());
  const toDay=Date.UTC(to.getFullYear(),to.getMonth(),to.getDate());
  return Math.max(0,Math.round((toDay-fromDay)/DAY_MS));
};

export const addBillingDays=(baseValue,days)=>{
  const base=validDate(baseValue)||new Date();
  const result=new Date(base);
  result.setDate(result.getDate()+Number(days||0));
  return billingDateISO(result);
};

export const addBillingMonths=(baseValue,months)=>{
  const base=validDate(baseValue)||new Date();
  const result=new Date(base);
  const originalDay=result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth()+Number(months||0));
  const lastDay=new Date(result.getFullYear(),result.getMonth()+1,0).getDate();
  result.setDate(Math.min(originalDay,lastDay));
  return billingDateISO(result);
};

export const pricePlanExtension=(plan,days)=>{
  const selected=BILLING_PLANS[plan]||BILLING_PLANS.ANNUAL;
  const referenceDays=Math.max(1,Number(selected.referenceDays||(selected.months===1?30:365)));
  return Math.round(Number(selected.amount||0)*Math.max(0,Number(days||0))/referenceDays);
};

export const priceExtraStoreExtension=(plan,days,count=1)=>{
  const monthly=plan==="MONTHLY";
  const referenceDays=monthly?30:365;
  const periodAmount=monthly?BILLING_CONFIG.extraStore.monthlyAmount:BILLING_CONFIG.extraStore.annualAmount;
  return Math.round(periodAmount*Math.max(0,Number(days||0))/referenceDays)*Math.max(0,Number(count||0));
};

export const prorateExtraStore = (remainingDays, totalDays = 365) =>
  Math.round(BILLING_CONFIG.extraStore.annualAmount * Math.max(0, Math.min(1, remainingDays / totalDays)));
