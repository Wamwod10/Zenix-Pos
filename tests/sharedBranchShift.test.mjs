import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const read=(relative)=>fs.readFileSync(path.join(here,"..",relative),"utf8");

test("StoreContext opens and consumes a store-scoped shared shift",()=>{
  const source=read("src/context/StoreContext.jsx");
  assert.match(source,/const activeShift = activeShifts\[currentStoreId\] \|\| null/);
  assert.match(source,/registerKey:`store:\$\{shift\.storeId\}`/);
  assert.doesNotMatch(source,/registerKey:shift\.registerKey\|\|`user:\$\{currentUser\?\.id\}`/);
});

test("Shifts keeps another cashier's open shift visible but control actions permission guarded",()=>{
  const source=read("src/pages/shifts/Shifts.jsx");
  assert.match(source,/const canControlShift=Boolean\(activeShift&&\(canRecon\|\|ownsShift\(activeShift\)\)\)/);
  assert.match(source,/canControlShift&&<div className="shift-actions">/);
  assert.match(source,/!canControlShift&&<StatusBadge tone="neutral">Faqat ko‘rish<\/StatusBadge>/);
  assert.match(source,/activeShift\?<StatusBadge tone="success">Smena ochiq<\/StatusBadge>/);
});
