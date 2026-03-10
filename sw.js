// sw.js — Service Worker для PWA Сменка
const CACHE_NAME = "smenka-v1.0.1"; // Меняйте при каждом релизе

// Файлы для кеширования при установке
const urlsToCache = [
  "./",
  "./index.html",
  "./main.js",
  "./main.css",
  "./manifest.json",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/favicon-32x32.png",
  "./images/favicon-16x16.png",
  "./images/banner.png",
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
