import test from "node:test";
import assert from "node:assert/strict";
import { customerDisplayName } from "../src/utils/customer.js";

test("sale history renders customer payloads as safe text", () => {
  assert.equal(customerDisplayName({ name: "Aziza" }), "Aziza");
  assert.equal(customerDisplayName({}), "Mijoz biriktirilmagan");
  assert.equal(customerDisplayName("Bekzod"), "Bekzod");
  assert.equal(customerDisplayName(null), "Mijoz biriktirilmagan");
});
