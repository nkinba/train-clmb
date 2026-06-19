// Breakteau Service Worker (Phase 1 baseline)
// S04 범위: 설치 + offline shell (HTML/CSS/JS만 캐시).
//
// TODO(S12): 본 SW는 v0 bootstrap. 다음을 S12에서 처리:
//   1. ADR-4 Workbox precacheAndRoute로 마이그레이션 (빌드 시 hashed asset manifest 주입)
//      → 현재 cache-first 전략은 재배포 후 cached HTML이 새 chunk hash를 참조해 broken 가능
//   2. skipWaiting + clients.claim 제거 또는 "update available, reload" UI 도입
//      → 진행 중 타이머/기록 세션에서 chunk swap이 일어나면 corrupt 위험
//   3. IndexedDB 기반 mutation queue + online 이벤트로 PocketBase flush (PRD NFR §4)

const CACHE_VERSION = "v0-bootstrap";
const SHELL_CACHE = `breakteau-shell-${CACHE_VERSION}`;

const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("breakteau-shell-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first → cache → offline shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((match) => match || caches.match("/index.html") || caches.match("/")),
        ),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
