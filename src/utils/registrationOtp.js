export const otpPhone = value => {
  const digits=String(value||'').replace(/\D/g,'');
  return /^998\d{9}$/.test(digits)?`+${digits}`:'';
};
export const otpRemaining = (deadline,now=Date.now()) => {
  const timestamp=typeof deadline==='number'?deadline:Date.parse(deadline);
  return Number.isFinite(timestamp)?Math.max(0,Math.ceil((timestamp-now)/1000)):0;
};
export const canRegisterTrial = (proof,phone,now=Date.now()) => Boolean(
  proof?.registrationToken && otpPhone(phone) && proof.phone===otpPhone(phone) && otpRemaining(proof.expiresAt,now)>0
);
