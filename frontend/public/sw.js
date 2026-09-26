const CACHE_PREFIX = "zenix-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const APP_SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

const offlineResponse = (request) => {
  const acceptsHtml = request.mode === "navigate";
  return new Response(
    acceptsHtml
      ? "<!doctype html><html lang=\"uz\"><meta charset=\"utf-8\"><title>Zenix POS</title><body><main>Zenix POS hozir offline. Internet ulanishini tekshiring.</main></body></html>"
      : "Zenix POS is offline",
    { status: 503, headers: { "Content-Type": acceptsHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8" } },
  );
};

const requireResponse = (value) => {
  if (!(value instanceof Response)) throw new TypeError("Service Worker fetch did not return a Response");
  return value;
};

const persist = (event, key, response) => {
  if (!response?.ok) return;
  const write = caches.open(CACHE_NAME).then((cache) => cache.put(key, response.clone())).catch(() => undefined);
  event.waitUntil(write);
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Business/API data must always come from the authenticated backend and must
  // never be persisted in the PWA shell cache.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const validResponse = requireResponse(response);
          persist(event, "/index.html", validResponse);
          return validResponse;
        })
        .catch(async () => (
          (await caches.match(request))
          || (await caches.match("/index.html"))
          || (await caches.match("/"))
          || offlineResponse(request)
        )),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = requireResponse(await fetch(request));
        persist(event, request, response);
        return response;
      } catch {
        return offlineResponse(request);
      }
    }),
  );
});
