const VERSION = "hc-editorial-v1";
const SHELL = `${VERSION}-shell`;
const DATOS = `${VERSION}-datos`;
const ARTE = `${VERSION}-arte`;
const scope = new URL("./", self.location).pathname.replace(/\/$/, "");
const enPanelLocal = scope === "/panel";
const base = enPanelLocal ? "/panel" : "";
const shellUrls = [
  `${base}/`, `${base}/app.js`, `${base}/styles.css`, `${base}/manifest.webmanifest`,
  `${base}/icons/icon-180.png`, `${base}/icons/icon-192.png`, `${base}/icons/icon-512.png`,
  "/templates/tokens.css", "/templates/pieza.css", "/templates/render.js",
  "/assets/fonts/DMSans-Regular.woff2", "/assets/fonts/DMSans-Medium.woff2",
  "/assets/fonts/Anton-Regular.woff2", "/assets/fonts/EBGaramond-Regular.woff2",
  "/assets/fonts/CormorantGaramond-Medium.woff2", "/assets/fonts/CormorantGaramond-SemiBold.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(shellUrls)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("hc-editorial-") && ![SHELL, DATOS, ARTE].includes(key))
    .map((key) => caches.delete(key)))) .then(() => self.clients.claim()));
});

async function redLuegoCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
    return response;
  } catch {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
    throw new Error("Sin conexión y sin una copia local disponible.");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && (
    url.pathname.startsWith("/api/lotes") || url.pathname.startsWith("/data/")
  )) {
    event.respondWith(redLuegoCache(request, DATOS));
    return;
  }
  if (request.destination === "image") {
    event.respondWith((async () => {
      const cache = await caches.open(ARTE);
      const guardada = await cache.match(request);
      if (guardada) return guardada;
      return redLuegoCache(request, ARTE);
    })());
    return;
  }
  if (url.origin === self.location.origin && shellUrls.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const guardada = await cache.match(request);
      if (guardada) return guardada;
      return redLuegoCache(request, SHELL);
    })());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "LIMPIAR_DATOS_EDITORIAL") {
    event.waitUntil(Promise.all([caches.delete(DATOS), caches.delete(ARTE)]));
  }
});
