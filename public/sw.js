// Service worker sederhana untuk PWA Kantin.
// Strategi: network-first untuk navigasi (agar data selalu fresh),
// cache-first untuk aset statis, plus offline shell.
const CACHE = "kantin-v4";
const APP_SHELL = ["/", "/offline.html", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Jangan cache Supabase / API lintas-origin
  if (url.origin !== self.location.origin) return;

  // API dinamis (/api/*): SELALU jaringan, jangan pernah sajikan cache basi.
  // Ini penyebab "Kelola Store" hanya menampilkan sebagian store sampai hard reload.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(req));
    return;
  }

  // Navigasi halaman: network-first, fallback offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/offline.html")))
    );
    return;
  }

  // Aset statis: cache-first
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
