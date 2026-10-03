const CACHE_NAME = "warmupexam-v3";
const urlsToCache = ["/css/output.css", "/images/logo.svg", "/offline.html"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(urlsToCache.map((u) => cache.add(u).catch(() => {})))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putSafe(req, res) {
  if (res && res.ok && res.type === "basic") {
    const clone = res.clone();
    caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) API aur private pages: kabhi cache nahi
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/dashboard") ||
      url.pathname.startsWith("/owner") || url.pathname.startsWith("/profile") ||
      url.pathname.startsWith("/attempt") || url.pathname.startsWith("/series")) {
    return; // browser normal network se le
  }

  // 2) Pages: network, fail ho to sirf offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () =>
        (await caches.match("/offline.html")) ||
        new Response("<h1>Offline</h1><p>Please check your internet connection.</p>",
          { status: 503, headers: { "Content-Type": "text/html" } })
      )
    );
    return;
  }

  // 3) JS / CSS: network-first (nayi deploy turant mile)
  if (/\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => { putSafe(req, res); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 4) Images / fonts: cache-first
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => { putSafe(req, res); return res; })
        .catch(() => new Response("", { status: 504 }))
    )
  );
});