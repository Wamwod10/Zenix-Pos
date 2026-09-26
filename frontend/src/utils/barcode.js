const toBarcodeSet = (items = [], exceptId = "") => new Set(
  (items || [])
    .filter((item) => !exceptId || String(item?.id || "") !== String(exceptId))
    .map((item) => String(item?.barcode || "").trim())
    .filter(Boolean)
);

export const normalizeBarcode = (value) => String(value || "").trim();

export const isBarcodeDuplicate = (items = [], barcode = "", exceptId = "") => {
  const clean = normalizeBarcode(barcode);
  return Boolean(clean && toBarcodeSet(items, exceptId).has(clean));
};

const randomDigits = (length) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
};

export const generateUniqueBarcode = (items = [], options = {}) => {
  const existing = toBarcodeSet(items, options.exceptId);
  const candidates = Array.isArray(options.candidates) ? [...options.candidates] : [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = normalizeBarcode(candidates.length ? candidates.shift() : `20${randomDigits(11)}`);
    if (candidate && !existing.has(candidate)) return candidate;
  }
  let counter = 0;
  while (counter < 1000) {
    const candidate = `20${String(Date.now()).slice(-9)}${String(counter).padStart(2, "0")}`.slice(0, 13);
    if (!existing.has(candidate)) return candidate;
    counter += 1;
  }
  throw new Error("Unique barcode could not be generated");
};
