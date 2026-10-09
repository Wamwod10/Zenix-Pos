const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const id = value => String(value ?? '');
const rows = value => Array.isArray(value) ? value : [];
const price = product => Math.max(0, number(product?.sellPrice ?? product?.price));

/**
 * Persisted lines carry cashier intent only. Call after workspaceReady: Sales'
 * projected inventory contains catalog, stockByStore and embedded tracking from
 * the same bootstrap. Separate hydrated inventory/serials/batches may override it.
 * No allocation, quantity reduction, or checkout authorization happens here.
 */
export function reconcilePersistedCart({lines = [], products = [], inventory = products, serials, batches, storeId, discountAllowed = true, discountLimit = 100} = {}) {
  const catalog = new Map(rows(products).map(product => [id(product.id), product]));
  const stock = new Map(rows(inventory).map(product => [id(product.id), product]));
  const changes = [];
  const reconciled = [];
  const requestedByProduct = new Map();
  for (const saved of rows(lines)) {
    const productId = id(saved?.id);
    requestedByProduct.set(productId, number(requestedByProduct.get(productId)) + Math.max(0, number(saved?.cartQty)));
  }
  let hasBlockingStockIssue = false;
  for (const saved of rows(lines)) {
    const productId = id(saved?.id);
    const product = catalog.get(productId);
    const name = product?.name || saved?.name || productId;
    const report = (type, details = {}) => changes.push({type, productId, name, ...details});
    if (!product || product.archived) {
      report('product_removed', {reason:product ? 'archived' : 'missing'});
      continue;
    }
    const currentStock = stock.get(productId);
    // A stockByStore map is authoritative: an absent branch entry means zero,
    // never another branch's projected quantity or a persisted cart snapshot.
    const available = Math.max(0, number(currentStock?.stockByStore
      ? currentStock.stockByStore[id(storeId)]
      : currentStock?.quantity ?? currentStock?.stock));
    const requested = number(saved.cartQty);
    const currentPrice = price(product);
    if (saved.sellPrice != null || saved.price != null) {
      const previousPrice = price(saved);
      if (previousPrice !== currentPrice) report(currentPrice > previousPrice ? 'price_increased' : 'price_decreased', {previousPrice, currentPrice});
    }
    const requestedDiscount = Math.max(0, number(saved.discountPercent));
    const discountPercent = discountAllowed ? Math.min(requestedDiscount, Math.max(0, Math.min(100, number(discountLimit)))) : 0;
    if (discountPercent !== requestedDiscount) report('discount_changed', {previousDiscount:requestedDiscount, currentDiscount:discountPercent});
    const belongs = record => (!record.productId || id(record.productId) === productId) && id(record.storeId) === id(storeId);
    const currentSerials = (serials === undefined ? rows(product.serializedUnits) : rows(serials).filter(record => id(record.productId) === productId));
    const currentBatches = (batches === undefined ? rows(product.stockBatches) : rows(batches).filter(record => id(record.productId) === productId));
    const serialById = new Map(currentSerials.filter(belongs).map(record => [id(record.id), record]));
    const batchById = new Map(currentBatches.filter(belongs).map(record => [id(record.id), record]));
    const next = {...product, sellPrice:currentPrice, price:currentPrice, quantity:available, stock:available, cartQty:requested, discountPercent,
      serializedUnits:currentSerials.filter(belongs), stockBatches:currentBatches.filter(belongs)};
    if (saved.tracking) {
      const seenSerials = new Set();
      const selectedSerials = [];
      for (const selection of rows(saved.tracking.serials)) {
        const selectionId = id(selection?.id ?? selection);
        const record = serialById.get(selectionId);
        if (product.serialTracking === false || !record || (record.status || 'IN_STOCK') !== 'IN_STOCK' || seenSerials.has(selectionId)) {
          report('serial_removed', {selectionId});
          continue;
        }
        seenSerials.add(selectionId);
        selectedSerials.push({id:record.id, serial:record.serial || '', unitOffset:selectedSerials.length});
      }
      const selectedBatches = [];
      const allocatedByBatch = new Map();
      let offset = 0;
      for (const selection of rows(saved.tracking.batches)) {
        const selectionId = id(selection?.batchId ?? selection?.id ?? selection);
        const record = batchById.get(selectionId);
        const quantity = number(selection?.quantity);
        const allocated = number(allocatedByBatch.get(selectionId)) + quantity;
        if (product.batchTracking === false || !record || quantity <= 0 || number(record.remaining) < allocated || (record.status && record.status !== 'IN_STOCK')) {
          report('batch_removed', {selectionId});
          continue;
        }
        allocatedByBatch.set(selectionId, allocated);
        selectedBatches.push({batchId:record.id, batchNo:record.batchNo || '', expiryDate:record.expiryDate || '', quantity, startOffset:offset, endOffset:offset + quantity});
        offset += quantity;
      }
      next.tracking = {quantity:requested, serials:selectedSerials, batches:selectedBatches, untrackedQty:Math.max(0, requested - selectedSerials.length)};
    }
    const totalRequested = requestedByProduct.get(productId);
    if (requested <= 0 || available + 1e-9 < totalRequested) {
      hasBlockingStockIssue = true;
      report(requested <= 0 ? 'invalid_quantity' : 'insufficient_stock', {requested:requested <= 0 ? requested : totalRequested, available});
    }
    reconciled.push(next);
  }
  return {lines:reconciled, changes, hasBlockingStockIssue};
}

/** Cashier-facing summary stays visible after restore, before checkout. */
export function cartReconciliationMessage(changes = []) {
  return changes.map(change => {
    const label = `${change.name}: `;
    switch (change.type) {
      case 'product_removed': return label + (change.reason === 'archived' ? 'arxivlangan mahsulot savatdan olib tashlandi.' : 'mahsulot topilmadi, savatdan olib tashlandi.');
      case 'price_increased': return label + `narx oshdi (${change.previousPrice} → ${change.currentPrice}).`;
      case 'price_decreased': return label + `narx tushdi (${change.previousPrice} → ${change.currentPrice}).`;
      case 'insufficient_stock': return label + `qoldiq yetarli emas (${change.requested} so‘ralgan, ${change.available} mavjud). Miqdorni tuzating.`;
      case 'invalid_quantity': return label + 'sotuv miqdorini tuzating.';
      case 'serial_removed': return label + `Serial / IMEI tanlovi olib tashlandi (${change.selectionId}).`;
      case 'batch_removed': return label + `partiya tanlovi olib tashlandi (${change.selectionId}).`;
      case 'discount_changed': return label + `chegirma yangilandi (${change.previousDiscount}% → ${change.currentDiscount}%).`;
      default: return '';
    }
  }).filter(Boolean).join(' ');
}
