// Fail-open service worker: static assets are cached (immutable hashes are safe);
// page navigations load from the network first (so devices always get the newest
// app build) with a cached-shell fallback when offline; all /api/* requests pass
// straight through untouched so live register data can never be served from cache.
const VER = "zonal-reg-v1";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.open(VER).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r && r.ok) c.put(e.request, r.clone()); return r; })))
    );
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const cp = r.clone(); caches.open(VER).then((c) => c.put(e.request, cp)); return r; })
        .catch(() => caches.open(VER).then((c) => c.match(e.request)).then((h) => h || new Response(
          "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><body style=\"font-family:system-ui;padding:2rem;text-align:center;color:#0a3b2a\"><h2>You are offline</h2><p>The register needs connection to load live records. This page will open normally once you are back online.</p></body>",
          { status: 503, headers: { "Content-Type": "text/html" } })))
    );
  }
});
