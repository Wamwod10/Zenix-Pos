import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("generated barcodes skip existing catalog values and remain scanner-searchable", async () => {
  const { generateUniqueBarcode, isBarcodeDuplicate } = await import("../src/utils/barcode.js");
  const existing=[{id:"p1",barcode:"2000000000001"},{id:"p2",barcode:"4780012345678"}];
  const barcode=generateUniqueBarcode(existing,{candidates:["2000000000001","2000000000002"]});
  assert.equal(barcode,"2000000000002");
  assert.equal(isBarcodeDuplicate(existing,barcode),false);
  assert.equal(isBarcodeDuplicate(existing,"4780012345678"),true);
  assert.equal(isBarcodeDuplicate(existing,"4780012345678","p2"),false);
});

test("product and receiving flows use server barcode generation and duplicate blocking", () => {
  const products=read("src/pages/products/Products.jsx");
  const inventory=read("src/pages/inventory/Inventory.jsx");
  const store=read("src/context/StoreContext.jsx");
  assert.match(products,/isBarcodeDuplicate/);
  assert.match(products,/generateBarcode/);
  assert.match(products,/generateProductBarcode/);
  assert.match(products,/Yaratish/);
  assert.match(inventory,/isBarcodeDuplicate/);
  assert.match(inventory,/generateBarcode/);
  assert.match(inventory,/generateReceiveBarcode/);
  assert.match(inventory,/generateQuickBarcode/);
  assert.match(store,/\/api\/products\/barcode\/generate/);
});

test("modal autofocus runs only when the modal opens so typed fields keep focus", () => {
  const modal=read("src/components/Modal.jsx");
  const inventory=read("src/pages/inventory/Inventory.jsx");
  assert.match(modal,/onCloseRef/);
  assert.match(modal,/useEffect\(\(\) => \{\s*onCloseRef\.current = onClose;/);
  assert.match(modal,/useEffect\(\(\) => \{[\s\S]*?\}, \[open\]\);/);
  assert.match(modal,/node\?\.contains\(document\.activeElement\)/);
  assert.doesNotMatch(modal,/window\.addEventListener\("keydown", onKey\);[\s\S]*?\}, \[open, onClose\]\);/);
  assert.doesNotMatch(inventory,/Shtrix-kod[\s\S]{0,500}<input data-modal-autofocus/);
  assert.match(inventory,/Mahsulot nomi \*<\/span><input data-modal-autofocus/);
});
