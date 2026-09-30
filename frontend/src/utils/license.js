const dateOnly=(value)=>String(value||"").slice(0,10);
const todayISO=(now)=>{const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};

export const workspaceAccessState = ({ organization, payments = [], now = Date.now() } = {}) => {
  const status = String(organization?.licenseStatus || "PAYMENT_REQUIRED").toUpperCase();
  const expiryDate=dateOnly(organization?.expiryDate);
  const expired=Boolean(expiryDate&&expiryDate<todayISO(now));
  if ((status === "ACTIVE" || status === "APPROVED") && !expired) return { allowed: true, reason: "ACTIVE" };
  if (status === "REVIEW") return { allowed: false, reason: "REVIEW" };
  if ((status === "ACTIVE" || status === "APPROVED") && expired) return { allowed: false, reason: "EXPIRED", expiry: organization.expiryDate };
  return { allowed: false, reason: status };
};
