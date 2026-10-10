import { formatWorkspaceDate, workspaceDateISO, workspaceTime } from "./workspaceDate.js";
export const RETURN_REASONS = [
  "Mahsulot ishlamadi",
  "Model mos kelmadi",
  "Mijoz fikridan qaytdi",
  "Brak mahsulot",
];

export const getReturnedQty = (item) => Number(item?.returnedQty || 0);

export const getAvailableReturnQty = (item) =>
  Math.max(0, Number(item?.quantity || 0) - getReturnedQty(item));

export const getReturnStatus = (item) => {
  const returnedQty = getReturnedQty(item);

  if (returnedQty <= 0) {
    return "none";
  }

  return getAvailableReturnQty(item) <= 0 ? "returned" : "partial_returned";
};

export const getItemOriginalPrice = (item) =>
  Number(item?.originalPrice ?? item?.price ?? item?.sellPrice ?? 0);

export const getItemFinalPrice = (item) =>
  Number(item?.finalPrice ?? item?.price ?? item?.sellPrice ?? 0);

export const getItemDiscountPerUnit = (item) =>
  Math.max(0, getItemOriginalPrice(item) - getItemFinalPrice(item));

export const getItemDiscountTotal = (item, qty = Number(item?.quantity || 0)) =>
  getItemDiscountPerUnit(item) * Number(qty || 0);

export const normalizeSaleItemReturn = (item) => {
  const originalPrice = getItemOriginalPrice(item);
  const finalPrice = getItemFinalPrice(item);

  return {
    ...item,
    price: finalPrice,
    originalPrice,
    finalPrice,
    itemDiscountPercent: Number(item?.itemDiscountPercent || 0),
    itemDiscountAmount: Number(item?.itemDiscountAmount || 0),
    returnedQty: getReturnedQty(item),
    returnStatus: item?.returnStatus || getReturnStatus(item),
  };
};

export const getSaleSubtotal = (sale) => {
  const items = sale?.items || [];

  if (!items.length) {
    return Number(sale?.saleSubtotal || sale?.total || sale?.saleTotal || 0);
  }

  return items.reduce(
    (acc, item) => acc + getItemOriginalPrice(item) * Number(item.quantity || 0),
    0,
  );
};

export const getSaleDiscountTotal = (sale) => {
  const items = sale?.items || [];

  if (!items.length) {
    return Number(sale?.saleDiscountTotal || 0);
  }

  return items.reduce(
    (acc, item) => acc + getItemDiscountTotal(item, item.quantity),
    0,
  );
};

export const normalizeSaleReturns = (sale) => {
  const items = (sale?.items || []).map(normalizeSaleItemReturn);
  const normalized = {
    ...sale,
    items,
    returnedTotal: Number(sale?.returnedTotal ?? items.reduce((sum,item)=>sum+getItemFinalPrice(item)*getReturnedQty(item),0)),
  };

  const saleSubtotal = Number(sale?.saleSubtotal ?? getSaleSubtotal(normalized));
  const saleDiscountTotal = Number(
    sale?.saleDiscountTotal ?? getSaleDiscountTotal(normalized),
  );
  const saleTotal =
    Number(sale?.saleTotal || 0) > 0
      ? Number(sale.saleTotal || 0)
      : Number(sale?.total ?? saleSubtotal - saleDiscountTotal);

  return {
    ...normalized,
    saleSubtotal,
    saleDiscountTotal,
    saleTotal,
    total: Number(sale?.total ?? saleTotal),
  };
};

export const getNetSoldQty = (item) => item?._financialSign===-1?-Number(item.quantity||0):getAvailableReturnQty(item);

export const getSaleNetTotal = (sale) => {
  if(sale?._financialType==='refund')return -Number(sale._financialAmount||0);
  if(sale?.returnedTotal!==undefined&&!sale?._itemScoped)return Math.max(0,Number(sale.saleTotal??sale.total??0)-Number(sale.returnedTotal||0));
  const items = sale?.items || [];

  if (!items.length) {
    return Math.max(
      0,
      Number(sale?.total || 0) - Number(sale?.returnedTotal || 0),
    );
  }

  return items.reduce(
    (acc, item) => acc + getItemFinalPrice(item) * getNetSoldQty(item),
    0,
  );
};

export const getSalesNetTotal = (sales) =>
  (sales || []).reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

export const getDayNetTotal = (day) => {
  const sales = day?.sales || [];

  if (sales.length) {
    return getSalesNetTotal(sales);
  }

  return Math.max(
    0,
    Number(day?.total || 0) - Number(day?.returnedTotal || 0),
  );
};

export const getSaleProfit = (sale) =>
  sale?._financialType==='refund'?Number(sale._financialProfit||0):(sale?.items || []).reduce((acc, item) => {
    const netQty = getNetSoldQty(item);
    const profitPerItem =
      getItemFinalPrice(item) - Number(item.unitCost??item.metadata?.unitCost??item.costPrice??0);

    return acc + profitPerItem * netQty;
  }, 0);

export const clampReturnQty = (item, qty) => {
  const availableQty = getAvailableReturnQty(item);
  const value = Math.round(Number(qty || 0)*1000)/1000;

  if (availableQty <= 0 || value <= 0 || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(value, availableQty);
};

export const applyReturnToSale = (sale, productId, requestedQty) => {
  const normalizedSale = normalizeSaleReturns(sale);
  const targetItem = normalizedSale.items.find(
    (item) => String(item.productId || item.id) === String(productId),
  );

  if (!targetItem) {
    return {
      sale: normalizedSale,
      returnedItem: null,
      quantity: 0,
      amount: 0,
    };
  }

  const quantity = clampReturnQty(targetItem, requestedQty);
  const amount = getItemFinalPrice(targetItem) * quantity;

  if (quantity <= 0) {
    return {
      sale: normalizedSale,
      returnedItem: targetItem,
      quantity: 0,
      amount: 0,
    };
  }

  const updatedItems = normalizedSale.items.map((item) => {
    if (String(item.productId || item.id) !== String(productId)) {
      return normalizeSaleItemReturn(item);
    }

    const returnedQty = getReturnedQty(item) + quantity;
    const updatedItem = {
      ...item,
      returnedQty,
    };

    return {
      ...updatedItem,
      returnStatus: getReturnStatus(updatedItem),
    };
  });

  return {
    sale: {
      ...normalizedSale,
      items: updatedItems,
      total: Number(normalizedSale.total || 0),
      saleTotal: Number(normalizedSale.saleTotal || normalizedSale.total || 0),
      returnedTotal: Number(normalizedSale.returnedTotal || 0) + amount,
    },
    returnedItem: targetItem,
    quantity,
    amount,
  };
};

export const applyReturnToSales = (sales, saleId, productId, requestedQty) => {
  let result = {
    sale: null,
    returnedItem: null,
    quantity: 0,
    amount: 0,
  };

  const updatedSales = (sales || []).map((sale) => {
    if (String(sale.id) !== String(saleId)) {
      return normalizeSaleReturns(sale);
    }

    result = applyReturnToSale(sale, productId, requestedQty);
    return result.sale;
  });

  return {
    sales: updatedSales,
    ...result,
  };
};

export const applyReturnToHistory = (
  salesHistory,
  dayId,
  saleId,
  productId,
  requestedQty,
) => {
  let result = {
    sale: null,
    returnedItem: null,
    quantity: 0,
    amount: 0,
  };

  const history = (salesHistory || []).map((day) => {
    const matchesDay =
      String(day.id) === String(dayId) || String(day.date) === String(dayId);

    if (!matchesDay) {
      return {
        ...day,
        sales: (day.sales || []).map(normalizeSaleReturns),
      };
    }

    const salesResult = applyReturnToSales(
      day.sales || [],
      saleId,
      productId,
      requestedQty,
    );

    result = salesResult;

    const paymentMethod = salesResult.sale?.paymentMethod;
    const amount = salesResult.amount;

    return {
      ...day,
      sales: salesResult.sales,
      total: Math.max(0, Number(day.total || 0) - amount),
      cash:
        paymentMethod === "cash"
          ? Math.max(0, Number(day.cash || 0) - amount)
          : Number(day.cash || 0),
      card:
        paymentMethod === "card"
          ? Math.max(0, Number(day.card || 0) - amount)
          : Number(day.card || 0),
      transfer:
        paymentMethod === "transfer"
          ? Math.max(0, Number(day.transfer || 0) - amount)
          : Number(day.transfer || 0),
      returnedTotal: Number(day.returnedTotal || 0) + amount,
    };
  });

  return {
    history,
    ...result,
  };
};

export const increaseInventoryQuantity = (inventory, productId, quantity) =>
  (inventory || []).map((product) =>
    String(product.id) === String(productId)
      ? {
          ...product,
          quantity: Number(product.quantity || 0) + Number(quantity || 0),
          stock: Number(product.quantity || 0) + Number(quantity || 0),
        }
      : product,
  );

export const buildReturnRecord = ({
  sale,
  item,
  quantity,
  amount,
  reason,
  seller,
  organization = {},
}) => {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    saleId: sale.id,
    productId: item.productId || item.id,
    productName: item.name,
    sku: item.sku,
    quantity,
    amount,
    reason,
    sellerId: sale.sellerId || seller?.id || "",
    sellerName: sale.sellerName || seller?.name || "",
    paymentMethod: sale.paymentMethod,
    date: formatWorkspaceDate(now, organization),
    dateISO: workspaceDateISO(now, organization.timezone),
    time: workspaceTime(now, organization),
  };
};

export const getRefundAllocation = (sale, amount, refundMethod = "original") => {
  const value=Math.max(0,Number(amount||0));
  if(refundMethod==="cash")return {cash:value,card:0,transfer:0};
  if(refundMethod==="card")return {cash:0,card:value,transfer:0};
  if(refundMethod==="transfer")return {cash:0,card:0,transfer:value};
  if(sale?.paymentMethod!=="split")return {
    cash:sale?.paymentMethod==="cash"?value:0,
    card:sale?.paymentMethod==="card"?value:0,
    transfer:sale?.paymentMethod==="transfer"?value:0,
  };
  const gross=Math.max(0,Number(sale?.saleTotal??sale?.total??0));
  const breakdown=sale?.paymentBreakdown||{};
  if(gross<=0)return {cash:0,card:0,transfer:0};
  const cash=value*(Math.max(0,Number(breakdown.cash||0))/gross);
  const card=value*(Math.max(0,Number(breakdown.card||0))/gross);
  const transfer=Math.max(0,value-cash-card);
  return {cash,card,transfer};
};

export const getRefundCashAdjustment = (sale, amount, refundMethod = "original", activeShiftId = "") => {
  const actual = getRefundAllocation(sale, amount, refundMethod);
  const sameShift = Boolean(activeShiftId) && String(sale?.shiftId || "") === String(activeShiftId);

  if (sameShift) {
    const original = getRefundAllocation(sale, amount, "original");
    const delta = Number(actual.cash || 0) - Number(original.cash || 0);
    if (Math.abs(delta) < 0.01) return null;
    return { type: delta > 0 ? "out" : "in", amount: Math.abs(delta) };
  }

  const cash = Math.max(0, Number(actual.cash || 0));
  return cash > 0.009 ? { type: "out", amount: cash } : null;
};

