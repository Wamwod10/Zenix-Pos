import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("mobile product card metadata uses two balanced columns with category spanning full width",()=>{
  const css=read("src/pages/products/product.scss");
  assert.match(css,/@media\(max-width:700px\)[\s\S]*?\.product-meta\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:6px\}/);
  assert.match(css,/\.product-meta>span:first-child\{grid-column:1\/-1\}/);
});

test("supplier selection does not make the avatar inherit identity flex growth",()=>{
  const css=read("src/pages/suppliers/supplier.scss");
  assert.doesNotMatch(css,/\.supplier-head\s*>\s*div:nth-child\(2\)\s*\{[^}]*flex:\s*1/);
  assert.match(css,/\.supplier-head \.supplier-identity\s*\{[^}]*flex:\s*1/);
});

test("product identity keeps thumbnail and copy in separate grid columns",()=>{
  const css=read("src/pages/products/product.scss");
  assert.match(css,/\.product-title-row\s*>\s*div\s*\{[^}]*flex:\s*1[^}]*min-width:\s*0/);
  assert.match(css,/\.product-title-row\s*>\s*div\s*>\s*\.product-thumb\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1\s*\/\s*3/);
});

test("supplier card checkbox is centered inside a stable selection slot",()=>{
  const css=read("src/pages/suppliers/supplier.scss");
  assert.match(css,/\.supplier-card-select\s*\{[^}]*width:\s*28px[^}]*align-items:\s*center[^}]*justify-content:\s*center/);
});
