import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const expected = [
  "/", "/shifts", "/sales", "/history", "/products", "/inventory", "/suppliers",
  "/expenses", "/analytics", "/seller-analytics", "/activity-log", "/settings", "/billing",
];

test("every protected sidebar module has a matching React route", () => {
  const app = read("../src/App.jsx");
  const layout = read("../src/layout/MainLayout.jsx");
  for (const absolutePath of expected) {
    const nestedPath = absolutePath === "/" ? null : absolutePath.slice(1);
    if (nestedPath) assert.match(app, new RegExp(`path=["']${nestedPath}["']`), `${absolutePath} route is missing`);
    else assert.match(app, /<Route index /, "dashboard index route is missing");
    assert.match(layout, new RegExp(`path:["']${absolutePath.replace("/", "\\/")}["']`), `${absolutePath} sidebar item is missing`);
  }
  assert.match(layout, /<NavLink/);
  assert.match(layout, /<Outlet\s*\/>/);
  assert.doesNotMatch(layout, /<Outlet[^>]*key=/);
});

test("Vercel sends direct SPA module requests to index.html after API rules", () => {
  const config = JSON.parse(read("../vercel.json"));
  const rewrites = config.rewrites || [];
  assert.ok(rewrites.findIndex((rule) => rule.source.startsWith("/api/")) < rewrites.findIndex((rule) => rule.source === "/(.*)"));
  assert.equal(rewrites.find((rule) => rule.source === "/(.*)")?.destination, "/index.html");
});

test("service worker updates bypass the HTTP cache", () => {
  assert.match(read("../src/main.jsx"), /register\("\/sw\.js",\{updateViaCache:"none"\}\)/);
});
