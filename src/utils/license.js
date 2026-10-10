const dateOnly=(value)=>String(value||"").slice(0,10);
const todayISO=(now,timeZone='Asia/Tashkent')=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));

export const workspaceAccessState = ({ organization, payments = [], now = Date.now() } = {}) => {
  const status = String(organization?.licenseStatus || "PAYMENT_REQUIRED").toUpperCase();
  const expiryDate=dateOnly(organization?.expiryDate);
  const expired=Boolean(expiryDate&&expiryDate<todayISO(now,organization?.timezone||'Asia/Tashkent'))||Boolean(organization?.settings?.trialEndsAt&&!(Date.parse(organization.settings.trialEndsAt)>now));
  if(status==='SUSPENDED')return {allowed:false,reason:status};
  if(organization?.settings?.billingHold)return {allowed:false,reason:'BILLING_HOLD'};
  if ((status === "ACTIVE" || status === "APPROVED") && !expired) return { allowed: true, reason: "ACTIVE" };
  if (status === "REVIEW") return { allowed: false, reason: "REVIEW" };
  if ((status === "ACTIVE" || status === "APPROVED") && expired) return { allowed: false, reason: "EXPIRED", expiry: organization.expiryDate };
  return { allowed: false, reason: status };
};
