import { getSaleNetTotal, getSaleProfit, normalizeSaleReturns } from "./returns.js";
import { workspaceDateISO, workspaceBusinessDateISO } from "./workspaceDate.js";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const recordDateKey = (record, timezone = "Asia/Tashkent") => {
  const direct = String(record?.businessDateISO || record?.dateISO || "");
  if (DATE_KEY.test(direct)) return direct;
  const value = record?.createdAt || record?.date || record?.closedAt || record?.openedAt;
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : workspaceDateISO(date, timezone);
};

export const shiftDateKey = (key, amount) => {
  if (!DATE_KEY.test(String(key || ""))) return "";
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return date.toISOString().slice(0, 10);
};

export const periodRange = (period, { from = "", to = "", timezone = "Asia/Tashkent", businessDay = null } = {}) => {
  const today = businessDay ? workspaceBusinessDateISO(new Date(), { timezone }, businessDay) : workspaceDateISO(new Date(), timezone);
  if (period === "all" || period === "Barcha davr") return { from: "", to: "" };
  if (period === "Custom") return { from: from || "", to: to || today };
  if (period === "month" || period === "Bu oy") return { from: `${today.slice(0, 7)}-01`, to: today };
  const days = period === "Bugun" || String(period) === "1" ? 1 : period === "7 kun" || String(period) === "7" ? 7 : period === "30 kun" || String(period) === "30" ? 30 : null;
  if (!days) return { from: "", to: today };
  return { from: shiftDateKey(today, -(days - 1)), to: today };
};

export const recordInPeriod = (record, period, options = {}) => {
  const key = recordDateKey(record, options.timezone);
  const range = periodRange(period, options);
  if (!key) return !range.from && !range.to;
  return (!range.from || key >= range.from) && (!range.to || key <= range.to);
};

export const previousPeriodRange = (period, options = {}) => {
  const current = periodRange(period, options);
  if (!current.from || !current.to) return null;
  const start = new Date(`${current.from}T12:00:00Z`);
  const end = new Date(`${current.to}T12:00:00Z`);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const previousTo = shiftDateKey(current.from, -1);
  return { from: shiftDateKey(previousTo, -(days - 1)), to: previousTo };
};

export const recordInRange = (record, range, timezone = "Asia/Tashkent") => {
  if (!range) return false;
  const key = recordDateKey(record, timezone);
  if (!key) return false;
  return (!range.from || key >= range.from) && (!range.to || key <= range.to);
};

export const matchesStore = (record, storeId, stores = []) => {
  if (!storeId || storeId === "all") return true;
  if (record?.storeId) return String(record.storeId) === String(storeId);
  const target = stores.find((item) => String(item.id) === String(storeId));
  if (!target) return false;
  return String(record?.store || record?.storeName || "") === String(target.name || "");
};

export const projectInventoryScope = (inventoryState = [], storeId = "all") => inventoryState.map((product) => {
  const stockByStore = product.stockByStore || {};
  const quantity = storeId === "all"
    ? Object.values(stockByStore).reduce((sum, value) => sum + Number(value || 0), 0)
    : Number(stockByStore?.[storeId] || 0);
  return { ...product, quantity, stock: quantity };
});

export const scopedSale = (sale, itemPredicate) => {
  const normalized = normalizeSaleReturns(sale);
  if (!itemPredicate) return normalized;
  return { ...normalized, items: normalized.items.filter(itemPredicate) };
};

export const saleNetRevenue = (sale) => getSaleNetTotal(normalizeSaleReturns(sale));
export const saleNetProfit = (sale) => getSaleProfit(normalizeSaleReturns(sale));

export const saleGrossPaymentBreakdown = (sale) => {
  const result={cash:0,card:0,transfer:0};
  if(!sale)return result;
  const gross=Math.max(0,Number(sale.saleTotal??sale.total??0));
  if(sale.paymentMethod!=="split"){
    if(Object.prototype.hasOwnProperty.call(result,sale.paymentMethod))result[sale.paymentMethod]=gross;
    return result;
  }
  const source=sale.paymentBreakdown||{};
  result.cash=Math.max(0,Number(source.cash||0));
  result.card=Math.max(0,Number(source.card||0));
  result.transfer=Math.max(0,Number(source.transfer||0));
  return result;
};

export const saleNetPaymentBreakdown = (sale) => {
  const normalized = normalizeSaleReturns(sale);
  const net = saleNetRevenue(normalized);
  const result = { cash: 0, card: 0, transfer: 0 };
  if (net <= 0) return result;
  if (normalized.paymentMethod !== "split") {
    if (Object.prototype.hasOwnProperty.call(result, normalized.paymentMethod)) result[normalized.paymentMethod] = net;
    return result;
  }
  const gross = Math.max(0, Number(normalized.saleTotal || normalized.total || 0));
  const source = normalized.paymentBreakdown || {};
  const totalBreakdown = Number(source.cash || 0) + Number(source.card || 0) + Number(source.transfer || 0);
  const basis = gross > 0 ? gross : totalBreakdown;
  if (basis <= 0) return result;
  const ratio = Math.min(1, net / basis);
  result.cash = Number(source.cash || 0) * ratio;
  result.card = Number(source.card || 0) * ratio;
  result.transfer = Number(source.transfer || 0) * ratio;
  const allocated = result.cash + result.card + result.transfer;
  if (allocated > 0 && Math.abs(allocated - net) > 0.01) {
    const scale = net / allocated;
    result.cash *= scale; result.card *= scale; result.transfer *= scale;
  }
  return result;
};

export const returnedAmountForSale = (sale) => {
  const normalized = normalizeSaleReturns(sale);
  return Math.max(0, Number(normalized.saleTotal || normalized.total || 0) - saleNetRevenue(normalized));
};
