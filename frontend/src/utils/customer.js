const DEFAULT_CUSTOMER_LABEL = "Mijoz biriktirilmagan";

export const customerDisplayName = (value, fallback = DEFAULT_CUSTOMER_LABEL) => {
  if (typeof value === "string") return value.trim() || fallback;
  if (value && typeof value === "object") {
    return String(value.name || "").trim() || fallback;
  }
  return fallback;
};
