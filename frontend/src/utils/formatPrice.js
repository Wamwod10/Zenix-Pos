const resolveCurrency = (currency) => {
  if (currency) return currency;
  if (typeof document !== "undefined") return document.documentElement.dataset.currency || "UZS";
  return "UZS";
};

export const formatPrice = (price, currency) => {
  const value = Number(price || 0);
  const code = resolveCurrency(currency);
  if (code === "UZS") return `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(value).replaceAll(" ", " ")} so‘m`;
  return new Intl.NumberFormat(code === "EUR" ? "de-DE" : "en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
};
