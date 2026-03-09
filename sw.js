// sw.js — Service Worker для PWA Сменка
const CACHE_NAME = "smenka-v1.0.0"; // Меняйте при каждом релизе

// Файлы для кеширования при установке
const urlsToCache = [
  "/smenka/",
  "/smenka/index.html",
  "/smenka/main.js",
  "/smenka/main.css",
  "/smenka/manifest.json",
  "/smenka/images/icon-192.png",
  "/smenka/images/icon-512.png",
  "/smenka/images/favicon-32x32.png",
  "/smenka/images/favicon-16x16.png",
  "/smenka/images/banner.png",
];

// Установка service worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Кеш открыт, версия:", CACHE_NAME);
      return cache.addAll(urlsToCache);
    }),
  );
  self.skipWaiting();
});

// Активация и удаление старых кешей
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Удаляем старый кеш:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Стратегия: сначала сеть, потом кеш (для HTML)
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    }),
  );
});

// Обработка сообщений от страницы
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "UPDATED" });
      });
    });
  }
});
