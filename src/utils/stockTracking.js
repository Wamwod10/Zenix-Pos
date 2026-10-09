const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (value) => Math.max(0, num(value, 0));
const asTime = (value) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

const storeSerialUnits = (product, storeId) => (product?.serializedUnits || [])
  .filter((unit) => String(unit.storeId || "") === String(storeId || ""));

const storeBatches = (product, storeId) => (product?.stockBatches || [])
  .filter((batch) => String(batch.storeId || "") === String(storeId || ""));

/**
 * Deducts the visible store quantity and, when tracking data exists, allocates
 * concrete serial/IMEI units and/or stock batches. Older untracked stock can
 * coexist with tracked stock, so tracking is strict only when it fully covers
 * the current store quantity.
 */
export function allocateTrackedStock(product, storeId, quantity, meta = {}) {
  const qty = positive(quantity);
  const stock = positive(product?.quantity ?? product?.stock);
  if (!product || qty <= 0) return { success:false, message:"Sotuv miqdori noto‘g‘ri" };
  if (stock + 1e-9 < qty) return { success:false, message:`${product.name || "Mahsulot"}: yetarli qoldiq mavjud emas` };

  const soldAt = meta.soldAt || new Date().toISOString();
  const saleId = meta.saleId || "";
  const tracking = { quantity:qty, serials:[], batches:[], untrackedQty:qty };
  let next = { ...product, quantity:stock - qty, stock:stock - qty };

  const allStoreSerials = storeSerialUnits(product, storeId);
  const availableSerials = allStoreSerials.filter((unit) => String(unit.status || "IN_STOCK") === "IN_STOCK");
  const fullySerialized = stock > 0 && availableSerials.length + 1e-9 >= stock;
  if (fullySerialized && availableSerials.length < qty) {
    return { success:false, message:`${product.name || "Mahsulot"}: sotuv uchun Serial / IMEI birliklari yetarli emas` };
  }
  const requestedSerials = Array.isArray(meta.selection?.serials) ? meta.selection.serials : [];
  let serialSelection = availableSerials.slice(0, Math.min(qty, availableSerials.length));
  if (requestedSerials.length) {
    const selectedIds = requestedSerials.map(entry => String(entry?.id ?? entry));
    serialSelection = selectedIds.map(id => availableSerials.find(unit => String(unit.id) === id && (!unit.productId || String(unit.productId) === String(product.id))));
    if (new Set(selectedIds).size !== selectedIds.length || serialSelection.some(unit => !unit) || selectedIds.length > qty || (fullySerialized && selectedIds.length !== qty)) {
      return {success:false, message:`${product.name || "Mahsulot"}: tanlangan Serial / IMEI mavjud emas yoki miqdori mos emas`};
    }
  }
  if (serialSelection.length) {
    const selectedIds = new Set(serialSelection.map((unit) => unit.id));
    next.serializedUnits = (product.serializedUnits || []).map((unit) => selectedIds.has(unit.id)
      ? { ...unit, status:"SOLD", saleId, soldAt }
      : unit);
    tracking.serials = serialSelection.map((unit, index) => ({
      id:unit.id,
      serial:unit.serial || "",
      unitOffset:index,
    }));
    tracking.untrackedQty = Math.max(0, qty - serialSelection.length);
  }

  const batches = storeBatches(product, storeId)
    .filter((batch) => positive(batch.remaining) > 0)
    .sort((a, b) => {
      const expiryA = a.expiryDate ? asTime(a.expiryDate) : Number.MAX_SAFE_INTEGER;
      const expiryB = b.expiryDate ? asTime(b.expiryDate) : Number.MAX_SAFE_INTEGER;
      if (expiryA !== expiryB) return expiryA - expiryB;
      return asTime(a.receivedAt) - asTime(b.receivedAt);
    });
  const batchAvailable = batches.reduce((sum, batch) => sum + positive(batch.remaining), 0);
  const fullyBatched = stock > 0 && batchAvailable + 1e-9 >= stock;
  if (fullyBatched && batchAvailable + 1e-9 < qty) {
    return { success:false, message:`${product.name || "Mahsulot"}: partiya qoldig‘i yetarli emas` };
  }
  const requestedBatches = Array.isArray(meta.selection?.batches) ? meta.selection.batches : [];
  let selectedBatches = batches;
  const requestedByBatch = new Map();
  if (requestedBatches.length) {
    selectedBatches = [];
    for (const selection of requestedBatches) {
      const key = String(selection.batchId ?? selection.id);
      const batch = batches.find(row => String(row.id) === key && (!row.productId || String(row.productId) === String(product.id)));
      const take = positive(selection.quantity);
      if (!batch || requestedByBatch.has(batch.id) || take <= 0 || take > positive(batch.remaining) || (batch.status && batch.status !== 'IN_STOCK')) return {success:false, message:`${product.name || "Mahsulot"}: tanlangan partiya mavjud emas yoki qoldiq yetarli emas`};
      requestedByBatch.set(batch.id, take);selectedBatches.push(batch);
    }
    const selectedQuantity = [...requestedByBatch.values()].reduce((sum, take) => sum + take, 0);
    if (Math.abs(selectedQuantity - Math.min(qty, batchAvailable)) > 1e-9) return {success:false, message:`${product.name || "Mahsulot"}: tanlangan partiya miqdori sotuvga mos emas`};
  }

  if (batches.length) {
    let left = qty;
    let offset = 0;
    const allocations = [];
    const remainingById = new Map();
    for (const batch of selectedBatches) {
      if (left <= 0) break;
      const available = positive(batch.remaining);
      const take = requestedByBatch.has(batch.id) ? requestedByBatch.get(batch.id) : Math.min(available, left);
      if (take <= 0) continue;
      allocations.push({
        batchId:batch.id,
        batchNo:batch.batchNo || "",
        expiryDate:batch.expiryDate || "",
        quantity:take,
        startOffset:offset,
        endOffset:offset + take,
      });
      remainingById.set(batch.id, available - take);
      offset += take;
      left -= take;
    }
    if (allocations.length) {
      next.stockBatches = (product.stockBatches || []).map((batch) => remainingById.has(batch.id)
        ? { ...batch, remaining:remainingById.get(batch.id) }
        : batch);
      tracking.batches = allocations;
    }
  }

  return { success:true, product:next, tracking };
}

/**
 * Restores the next returned slice of a previously allocated sale line.
 * previousReturnedQty is the quantity returned before this operation, which
 * lets partial returns restore the correct serials/batches exactly once.
 */
export function restoreTrackedStock(product, storeId, quantity, tracking = null, previousReturnedQty = 0, meta = {}) {
  const qty = positive(quantity);
  if (!product || qty <= 0) return { success:false, message:"Qaytarish miqdori noto‘g‘ri" };
  const before = positive(product.quantity ?? product.stock);
  const start = positive(previousReturnedQty);
  const end = start + qty;
  const returnedAt = meta.returnedAt || new Date().toISOString();
  const returnId = meta.returnId || "";
  const saleId = meta.saleId || "";
  let next = { ...product, quantity:before + qty, stock:before + qty };

  const serials = Array.isArray(tracking?.serials) ? tracking.serials : [];
  const serialSlice = serials.filter((entry) => {
    const offset = positive(entry.unitOffset);
    return offset >= start && offset < end;
  });
  if (serialSlice.length) {
    const ids = new Set(serialSlice.map((entry) => entry.id));
    next.serializedUnits = (product.serializedUnits || []).map((unit) => {
      if (!ids.has(unit.id)) return unit;
      if (storeId && String(unit.storeId || "") !== String(storeId)) return unit;
      return {
        ...unit,
        status:"IN_STOCK",
        saleId:"",
        soldAt:"",
        returnedAt,
        returnId,
        lastSaleId:saleId || unit.saleId || "",
      };
    });
  }

  const allocations = Array.isArray(tracking?.batches) ? tracking.batches : [];
  if (allocations.length) {
    const restoreByBatch = new Map();
    allocations.forEach((allocation) => {
      const allocationStart = positive(allocation.startOffset);
      const allocationEnd = Math.max(allocationStart, positive(allocation.endOffset || allocationStart + positive(allocation.quantity)));
      const overlap = Math.max(0, Math.min(end, allocationEnd) - Math.max(start, allocationStart));
      if (overlap > 0) restoreByBatch.set(allocation.batchId, positive(restoreByBatch.get(allocation.batchId)) + overlap);
    });
    if (restoreByBatch.size) {
      next.stockBatches = (product.stockBatches || []).map((batch) => {
        if (!restoreByBatch.has(batch.id)) return batch;
        if (storeId && String(batch.storeId || "") !== String(storeId)) return batch;
        const maximum = positive(batch.quantity);
        const restored = positive(batch.remaining) + positive(restoreByBatch.get(batch.id));
        return { ...batch, remaining:maximum > 0 ? Math.min(maximum, restored) : restored };
      });
    }
  }

  return { success:true, product:next, restored:{serials:serialSlice, quantity:qty} };
}

export function trackingSummary(tracking) {
  if (!tracking) return { serialCount:0, batchCount:0 };
  return {
    serialCount:Array.isArray(tracking.serials) ? tracking.serials.length : 0,
    batchCount:Array.isArray(tracking.batches) ? tracking.batches.length : 0,
  };
}
