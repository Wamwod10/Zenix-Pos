const CACHE_PREFIX = "zenix-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const APP_SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

const offlineResponse = (request) => new Response(
  request.mode === "navigate"
    ? "<!doctype html><html lang=\"uz\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Zenix POS</title><body><main style=\"font:16px system-ui;padding:32px\">Zenix POS hozir offline. Internet ulanishini tekshiring.</main></body></html>"
    : "Zenix POS is offline",
  {status:503,headers:{"Content-Type":request.mode === "navigate"?"text/html; charset=utf-8":"text/plain; charset=utf-8"}},
);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map((key)=>caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("message",(event)=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});

self.addEventListener("fetch", (event) => {
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;

  // SPA navigations are network-first and are never cached under arbitrary route
  // names. On a real network failure we serve the cached app shell.
  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response instanceof Response&&response.ok)return response;
        if(response instanceof Response&&response.status<500)return response;
        throw new Error(`navigation ${response?.status||"failed"}`);
      }catch{
        return (await caches.match("/index.html"))||(await caches.match("/"))||offlineResponse(request);
      }
    })());
    return;
  }

  // Fingerprinted/static assets can be cache-first. Every branch returns a Response.
  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached instanceof Response)return cached;
    try{
      const response=await fetch(request);
      if(!(response instanceof Response))throw new TypeError("Invalid fetch response");
      if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.put(request,clone)).catch(()=>undefined))}
      return response;
    }catch{return offlineResponse(request)}
  })());
});
