import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function loadWorker({ fetchImpl, cacheEntries = new Map(), cacheNames = ["zenix-shell-v1", "other-app-cache"] } = {}) {
  const listeners = new Map();
  const deleted = [];
  const puts = [];
  const cache = {
    addAll: async () => undefined,
    put: async (request, response) => { puts.push([String(request), response]); },
  };
  const caches = {
    open: async () => cache,
    keys: async () => cacheNames,
    delete: async (key) => { deleted.push(key); return true; },
    match: async (request) => cacheEntries.get(typeof request === "string" ? request : request.url),
  };
  const self = {
    location: { origin: "https://zenix-pos.test" },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, URL, Response, console });
  return { listeners, deleted, puts };
}

async function dispatchFetch(worker, request) {
  let responsePromise;
  const background = [];
  worker.listeners.get("fetch")({
    request,
    respondWith(value) { responsePromise = Promise.resolve(value); },
    waitUntil(value) { background.push(Promise.resolve(value)); },
  });
  assert.ok(responsePromise, "same-origin GET requests must be handled");
  const response = await responsePromise;
  await Promise.all(background);
  return response;
}

test("offline SPA navigation always resolves to a valid Response", async () => {
  const worker = loadWorker({ fetchImpl: async () => { throw new TypeError("offline"); } });
  const response = await dispatchFetch(worker, { method: "GET", mode: "navigate", url: "https://zenix-pos.test/products" });
  assert.ok(response instanceof Response);
  assert.equal(response.status, 503);
});

test("offline SPA navigation falls back to the cached app shell", async () => {
  const shell = new Response("<main>Zenix POS</main>", { status: 200, headers: { "Content-Type": "text/html" } });
  const worker = loadWorker({
    fetchImpl: async () => { throw new TypeError("offline"); },
    cacheEntries: new Map([["/index.html", shell]]),
  });
  const response = await dispatchFetch(worker, { method: "GET", mode: "navigate", url: "https://zenix-pos.test/sales" });
  assert.equal(await response.text(), "<main>Zenix POS</main>");
});

test("failed uncached asset requests still resolve to a valid Response", async () => {
  const worker = loadWorker({ fetchImpl: async () => { throw new TypeError("offline"); } });
  const response = await dispatchFetch(worker, { method: "GET", mode: "cors", url: "https://zenix-pos.test/assets/products.js" });
  assert.ok(response instanceof Response);
});

test("activation removes only obsolete Zenix caches", async () => {
  const worker = loadWorker({ fetchImpl: async () => new Response("ok") });
  let activation;
  worker.listeners.get("activate")({ waitUntil(value) { activation = Promise.resolve(value); } });
  await activation;
  assert.deepEqual(worker.deleted, ["zenix-shell-v1"]);
});

