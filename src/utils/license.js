export const workspaceAccessState = ({ organization, payments = [], now = Date.now() } = {}) => {
  const status = String(organization?.licenseStatus || "PAYMENT_REQUIRED").toUpperCase();
  const expiry = organization?.expiryDate ? new Date(organization.expiryDate).getTime() : null;
  if ((status === "ACTIVE" || status === "APPROVED") && (!expiry || expiry >= now)) {
    return { allowed: true, reason: "ACTIVE" };
  }
  if (status === "REVIEW") {
    // A receipt being uploaded is not proof of payment. Access only opens after
    // an approved payment (or, later, a verified provider webhook).
    return { allowed: false, reason: "REVIEW" };
  }
  if ((status === "ACTIVE" || status === "APPROVED") && expiry && expiry < now) {
    return { allowed: false, reason: "EXPIRED", expiry };
  }
  return { allowed: false, reason: status };
};
