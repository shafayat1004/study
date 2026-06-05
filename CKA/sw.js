const CACHE_NAME = "cka-guide-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./tasks/index.html",
  "./tasks/tasks.json",
  "./tasks/assets/tasks.css",
  "./tasks/assets/tasks.js",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/svg/affinity-taints.svg",
  "./assets/svg/cluster-architecture.svg",
  "./assets/svg/deployment-strategies.svg",
  "./assets/svg/ha-etcd-topologies.svg",
  "./assets/svg/network-policy-selectors.svg",
  "./assets/svg/pod-networking-model.svg",
  "./assets/svg/probe-timeline.svg",
  "./assets/svg/rbac-relationships.svg",
  "./assets/svg/service-networking-storage.svg",
  "./assets/svg/service-types.svg",
  "./assets/svg/storage-binding-reclaim.svg",
  "./assets/svg/troubleshooting-decision-tree.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }))
  );
});
