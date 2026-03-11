// sw.js — Исправленная версия
const CACHE_NAME = "smenka-v1.0.2";

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
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Кеш открыт, версия:", CACHE_NAME);
      return cache.addAll(urlsToCache);
    }),
  );
  self.skipWaiting();
});

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

// ГЛАВНОЕ ИСПРАВЛЕНИЕ: Всегда сначала кэш, потом сеть
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Если есть в кэше — возвращаем мгновенно
      if (cachedResponse) {
        return cachedResponse;
      }

      // Нет в кэше — грузим из сети
      return fetch(event.request).then((networkResponse) => {
        // Кэшируем только если это наш файл (не API, не внешние скрипты)
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }),
  );
});

// Обработка обновлений
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
