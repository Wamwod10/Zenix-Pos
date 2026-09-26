import test from "node:test";
import assert from "node:assert/strict";
import { columnIdsKey, columnValuesKey } from "../src/utils/columnLayout.js";

test("equivalent inline column definitions share one stable dependency key", () => {
  const first = [{ id: "purpose", label: "Maqsad" }, { id: "status", label: "Holat" }];
  const second = [{ id: "purpose", label: "Maqsad" }, { id: "status", label: "Holat" }];

  assert.equal(columnIdsKey(first), columnIdsKey(second));
  assert.notEqual(columnIdsKey(first), columnIdsKey([...second].reverse()));
  assert.equal(columnValuesKey(["status"]), columnValuesKey(["status"]));
  assert.notEqual(columnValuesKey(["status"]), columnValuesKey(["amount"]));
});
