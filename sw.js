const CACHE_NAME = "kumako-v8";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=8",
  "./app.js?v=8",
  "./game-core.js?v=8",
  "./manifest.webmanifest?v=8",
  "./assets/library-background.png",
  "./assets/icon-192.png?v=8",
  "./assets/icon-512.png?v=8",
  "./assets/apple-touch-icon.png?v=8",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name.startsWith("kumako-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
