const dateOnly=value=>String(value||'').slice(0,10);
const todayISO=(now,timeZone='Asia/Tashkent')=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export const workspaceAccessState=({organization,now=Date.now()}={})=>{
  if(!organization)return {allowed:false,readOnly:true,reason:'PAYMENT_REQUIRED'};
  const status=String(organization.licenseStatus||'PAYMENT_REQUIRED').toUpperCase();
  if(status==='SUSPENDED'||organization.accessMode==='SUSPENDED')return {allowed:false,readOnly:true,reason:'SUSPENDED'};
  const trial=organization.settings?.trialEndsAt;
  const expiry=dateOnly(organization.expiryDate);
  const expired=trial?!(Date.parse(trial)>now):Boolean(expiry&&expiry<todayISO(now,organization.planCode&&!organization.legacy?'Asia/Tashkent':organization.timezone||'Asia/Tashkent'));
  const reason=organization.settings?.billingHold?'BILLING_HOLD':expired||status==='EXPIRED'?'EXPIRED':['ACTIVE','APPROVED'].includes(status)?'ACTIVE':status;
  return {allowed:true,readOnly:organization.accessMode==='READ_ONLY'||reason!=='ACTIVE',reason,expiry:organization.expiryDate};
};
