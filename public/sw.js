/*
 * Saathi service worker. Hand-written on purpose: the app needs a few specific guarantees
 * (SOS and the Rights library work with no signal) and no more.
 *
 *  - Install: cache the main pages AND the JS/CSS/fonts they use, so they hydrate offline
 *    even if the worker never opened them online first.
 *  - Pages: network first with a short timeout, so a stalled 2G connection falls back to
 *    the cache instead of hanging. Unknown pages offline fall back to the SOS screen.
 *  - Hashed /_next/static assets: cache first (they never change for a given URL).
 *  - /api/*: never cached or intercepted. The app handles being offline itself.
 *
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const SHELL = "saathi-shell-" + VERSION;
const ASSETS = "saathi-assets-" + VERSION;

const PRECACHE = ["/", "/sos", "/rights", "/earnings", "/help", "/help/documents", "/help/complaint"];
const OFFLINE_FALLBACK = "/sos";

const ASSET_RE = /\/_next\/static\/[^"'\\\s)<>]+/g;

// Pages are keyed by path only, so /earnings?fresh=1 and /earnings share one entry.
const pageKey = (url) => new Request(new URL(url).origin + new URL(url).pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      const assets = await caches.open(ASSETS);

      const cacheAsset = async (path) => {
        try {
          const res = await fetch(path);
          if (!res.ok) return;
          await assets.put(path, res.clone());
          if (path.endsWith(".css")) {
            // Fonts are referenced from CSS, not from the page HTML.
            const css = await res.text();
            const fonts = new Set(css.match(ASSET_RE) || []);
            await Promise.all([...fonts].map((f) => cacheAsset(f)));
          }
        } catch {
          /* one missing asset must not fail the whole install */
        }
      };

      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            const res = await fetch(path, { cache: "reload" });
            if (!res.ok) return;
            await shell.put(pageKey(location.origin + path), res.clone());
            const html = await res.text();
            await Promise.all([...new Set(html.match(ASSET_RE) || [])].map(cacheAsset));
          } catch {
            /* offline during install: runtime caching will fill in later */
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
      const keep = new Set([SHELL, ASSETS]);
      for (const name of await caches.keys()) {
        if (name.startsWith("saathi-") && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  const key = pageKey(request.url);
  const cached = await cache.match(key);
  try {
    // With a cached copy, give up on a slow network quickly. Without one, wait longer.
    const res = await fetchWithTimeout(request, cached ? 4000 : 15000);
    if (res.ok && !res.redirected) cache.put(key, res.clone());
    return res;
  } catch {
    return cached || (await cache.match(pageKey(location.origin + OFFLINE_FALLBACK))) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  // Next's client-side navigation payloads must always be fresh.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});
