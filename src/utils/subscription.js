export const RESOURCE_LABELS={employees:'Faol xodimlar',stores:'Filiallar',warehouses:'Omborlar',registers:'Faol POS kassalar',products:'Mahsulotlar',customers:'Mijozlar'};
export function annualSaving(plan){
  const full=Number(plan?.prices?.MONTHLY||0)*12,annual=Number(plan?.prices?.ANNUAL||0);
  const amount=Math.max(0,full-annual);return {amount,percent:full?Math.round(amount/full*100):0};
}
export function subscriptionAction(state,target,plans,now=Date.now()){
  if(state?.trialEndsAt&&Date.parse(state.trialEndsAt)>now)return 'TRIAL';
  if(state?.accessMode!=='READ_WRITE'||!state?.billingInterval)return 'ACTIVATE';
  const current=plans.find(p=>p.code===state.planCode),next=plans.find(p=>p.code===target);
  if(!current||!next)return 'ACTIVATE';
  return next.rank<current.rank?'DOWNGRADE':next.rank>current.rank?'UPGRADE':'RENEW';
}
export function subscriptionSummary(draft){
  if(!draft)return null;const quote=draft.metadata?.subscription;
  if(!quote)return null;
  return {planCode:quote.planCode,billingInterval:quote.billingInterval,gross:Number(quote.grossAmount),credit:Number(draft.creditAmount||0),discount:Number(draft.metadata?.promoDiscount||0),total:Number(draft.totalAmount)};
}
export function subscriptionDraftUsable(draft,state,now=Date.now()){
  if(!draft||!state||!(Date.parse(draft.expiresAt)>now))return false;
  const quote=draft.metadata?.subscription;
  if(!quote)return true;
  if(quote.subscriptionVersion!==state.version)return false;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  return quote.action!=='UPGRADE'||quote.pricingDay===day;
}
