/**
 * Liftlog service worker.
 *
 * Written by hand rather than generated. Next 16 builds with Turbopack, and
 * @serwist/next hooks into webpack, so the generated route was not available
 * without an experimental adapter. The caching this app needs is small enough
 * to state in one file, and being able to reason about it completely matters
 * more here than usual: the failure mode is a lifter in a basement with no
 * signal and a workout half logged.
 *
 * Strategy, by request kind:
 *
 *   navigation      network first, fall back to the cached page, then to the
 *                   offline page. Fresh HTML when there is signal, the app
 *                   when there is not.
 *   /_next/static   cache first. These URLs are content-hashed and immutable,
 *                   so a cached copy is never the wrong copy.
 *   fonts           cache first, same reason.
 *   Supabase & API  never cached. Stale training data is worse than none, and
 *                   the sync queue in IndexedDB is what makes writes durable.
 *
 * Note what is deliberately absent: there is no caching of the user's data
 * here at all. The local database owns that, and it is the thing that makes
 * the app work offline. The worker only has to deliver the shell.
 */

const VERSION = "v1";
const SHELL_CACHE = `liftlog-shell-${VERSION}`;
const ASSET_CACHE = `liftlog-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

/** Routes worth having before the first offline launch. */
const SHELL_ROUTES = ["/today", "/progress", "/body", "/plan", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one failed route cannot fail the whole install.
      await Promise.all(
        SHELL_ROUTES.map(async (route) => {
          try {
            const response = await fetch(route, { cache: "reload" });
            if (response.ok) await cache.put(route, response);
          } catch {
            // Installed while offline. The runtime handlers will fill this in.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("liftlog-") && !keep.has(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  /\.(?:woff2?|png|svg|ico|webp)$/.test(url.pathname);

const isNeverCached = (url) =>
  url.pathname.startsWith("/api/") ||
  url.pathname.startsWith("/auth/") ||
  url.hostname.endsWith(".supabase.co");

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable, and a cross-origin POST must pass straight through.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isNeverCached(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && isAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // Google Fonts files are immutable too, and worth having offline so the
  // app does not fall back to a system face in the gym.
  if (url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const url = new URL(request.url);
    return (
      (await cache.match(request)) ??
      (await cache.match(url.pathname)) ??
      (await cache.match(OFFLINE_URL)) ??
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    // Opaque cross-origin responses are cached too: a font we cannot inspect
    // is still a font we can serve back.
    if (response.ok || response.type === "opaque") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (cause) {
    const fallback = await cache.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    throw cause;
  }
}

/** Lets the page ask a waiting worker to take over immediately. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") void self.skipWaiting();
});
