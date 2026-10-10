import { getItemDiscountPerUnit, getNetSoldQty, getSaleNetTotal, getSaleProfit, normalizeSaleReturns } from "./returns.js";
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

const emptySellerRow = (id, name) => ({
  id:String(id),name:name || "Noma’lum",sales:0,grossSales:0,profit:0,count:0,discount:0,
  returnAmount:0,returnedSales:0,cash:0,card:0,transfer:0,products:{},
});

export const buildSellerAnalyticsRows = ({
  employees = [],sales = [],shiftHistory = [],period = "all",timezone = "Asia/Tashkent",
  businessDay = null,store = "all",stores = [],
} = {}) => {
  const rows = new Map();
  employees.forEach((employee) => {
    const role=String(employee?.role||employee?.appRole||"").toUpperCase();
    if(employee?.active===false||!(["CASHIER","SALES"].includes(role))||!matchesStore(employee,store,stores))return;
    const identity=employee?.id||employee?.accountId||`name:${employee?.name||"Noma’lum"}`;
    rows.set(String(identity),emptySellerRow(identity,employee?.name));
  });

  sales.forEach((sale) => {
    const name=sale?.sellerName||sale?.seller||"Noma’lum";
    const identity=String(sale?.sellerId||sale?.sellerAccountId||`name:${name}`);
    if(!rows.has(identity))rows.set(identity,emptySellerRow(identity,name));
    const row=rows.get(identity);
    const netRevenue=saleNetRevenue(sale);
    const returned=returnedAmountForSale(sale);
    const payment=saleNetPaymentBreakdown(sale);
    row.sales+=netRevenue;
    row.grossSales+=netRevenue+returned;
    row.returnAmount+=returned;
    row.returnedSales+=returned>0?1:0;
    row.profit+=saleNetProfit(sale);
    row.count+=sale._financialType==='refund'?0:1;
    row.cash+=payment.cash;
    row.card+=payment.card;
    row.transfer+=payment.transfer;
    (sale.items||[]).forEach((item) => {
      const qty=getNetSoldQty(item);
      row.discount+=getItemDiscountPerUnit(item)*qty;
      if(qty>0)row.products[item.name]=(row.products[item.name]||0)+qty;
    });
  });

  rows.forEach((row) => {
    row.avg=row.count?row.sales/row.count:0;
    row.returnRate=row.grossSales?(row.returnAmount/row.grossSales)*100:0;
    row.shifts=shiftHistory.filter((shift) => (
      ((shift.cashierId||shift.cashierAccountId)?String(shift.cashierId||shift.cashierAccountId)===row.id:shift.cashierName===row.name)
      && recordInPeriod(shift,period,{timezone,businessDay})
      && matchesStore(shift,store,stores)
    )).length;
  });
  return [...rows.values()].sort((a,b)=>b.sales-a.sales);
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
  return { ...normalized, _itemScoped:true, items: normalized.items.filter(itemPredicate) };
};

export const saleNetRevenue = (sale) => getSaleNetTotal(normalizeSaleReturns(sale));
export const saleNetProfit = (sale) => sale?._financialType==='refund'?Number(sale._financialProfit||0):getSaleProfit(normalizeSaleReturns(sale));

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
  if(sale?._financialPayment)return {...sale._financialPayment};
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
  if(sale?._financialType==='refund')return Number(sale._financialAmount||0);
  const normalized = normalizeSaleReturns(sale);
  return Math.max(0, Number(normalized.saleTotal || normalized.total || 0) - saleNetRevenue(normalized));
};

// Reports use dated sale and refund events; sale history keeps lifetime net values.
export const financialSalesEvents=(sales=[],returns=[])=>{
 const byId=new Map(sales.map(sale=>[sale.id,sale]));
 const events=sales.map(sale=>({...sale,_financialType:'sale',returnedTotal:0,returnedAmount:0,items:(sale.items||[]).map(item=>({...item,returnedQty:0,returnStatus:'none'})),_financialPayment:capturedPayment(sale)}));
 for(const ret of returns){
   const sale=byId.get(ret.saleId),item=sale?.items?.find(line=>String(line.productId||line.id)===String(ret.productId));
   const amount=Number(ret.amount||0),qty=Number(ret.quantity||0),cost=Number(ret.unitCost??ret.metadata?.unitCost??item?.unitCost??item?.metadata?.unitCost??item?.costPrice??0);
   const breakdown=ret.refundBreakdown||ret.metadata?.refundBreakdown;
    events.push({...sale,...ret,id:`refund:${ret.id}`,originalSellerId:sale?.sellerId,originalSellerName:sale?.sellerName,sellerId:ret.createdBy||ret.actorId||ret.metadata?.actorId||sale?.sellerId,sellerAccountId:ret.createdBy||ret.actorId||ret.metadata?.actorId||sale?.sellerId,sellerName:ret.actorName||ret.createdByName||ret.metadata?.actorName||sale?.sellerName,seller:ret.actorName||ret.createdByName||ret.metadata?.actorName||sale?.sellerName,storeId:ret.storeId||sale?.storeId,
     businessDateISO:recordDateKey(ret),dateISO:ret.dateISO||recordDateKey(ret),date:ret.date,createdAt:ret.createdAt,
     _financialType:'refund',_financialAmount:amount,_financialProfit:-amount+qty*cost,returnedTotal:amount,total:amount,saleTotal:amount,
     items:[{...item,_financialSign:-1,productId:ret.productId,name:item?.name||ret.productName,quantity:qty,returnedQty:0,finalPrice:qty?amount/qty:0}],
     _financialPayment:{cash:-Number(breakdown?.cash||0),card:-Number(breakdown?.card||0),transfer:-Number(breakdown?.transfer||0)}});
 }
 return events;
};
const capturedPayment=sale=>{
 const result={cash:0,card:0,transfer:0};
 if(Array.isArray(sale.payments)&&sale.payments.length){for(const payment of sale.payments)if(Object.hasOwn(result,payment.method))result[payment.method]+=Number(payment.amount||0);return result}
 if(sale.paymentBreakdown){for(const method of Object.keys(result))result[method]=Number(sale.paymentBreakdown[method]||0);return result}
 return saleGrossPaymentBreakdown(sale);
};
export const netItemContribution = (item = {}) => {
  const sign = item._financialSign === -1 ? -1 : 1;
  const qty = sign * Math.max(0, Number(item.quantity ?? item.qty ?? 0) - Number(item.returnedQty || 0));
  return {qty, revenue: Number(item.finalPrice ?? item.price ?? 0) * qty};
};
