/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Flare service worker (PW5, ADR-0010, ADR-0014). Precaches the app shell and the map pack
// so the app opens with no signal (SRS-OFF-4); answers navigations from the network first,
// then from the cache; shows Lit notices from sealed pushes (SRS-IF-3). It never handles
// /api/ or /hub, so writes always go through the page's outbox.

import {
  CACHE_PREFIX,
  MAP_PACK,
  NAV_TIMEOUT_MS,
  navigationFallbacks,
  precacheList,
  routeFor,
  SHELLS,
  staleCaches,
} from "#lib/push/cache-plan.ts";
import { buildNotice } from "#lib/push/notice.ts";
import { createStore } from "#lib/store/index.ts";
import { version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `${CACHE_PREFIX}${version}`;
// SvelteKit 3 lists paths relative to the base path (no base is set: the app owns "/").
const abs = (list: Array<{ path: string }>) => list.map((p) => `/${p.path.replace(/^\/+/, "")}`);
const ASSETS = precacheList(abs(immutable), abs(assets), abs(prerendered));
const PRECACHED = new Set(ASSETS);
const store = createStore();

sw.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS);
      // The SPA shell and the map pack may not be in the lists; add what exists.
      for (const extra of [...SHELLS, MAP_PACK]) {
        if (PRECACHED.has(extra)) continue;
        try {
          const res = await fetch(extra, { cache: "reload" });
          if (res.ok) await cache.put(extra, res);
        } catch {
          // Missing from this build; navigations fall back to the next shell.
        }
      }
    })(),
  );
  // No skipWaiting here: the page asks first ("New version. Reload?").
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of staleCaches(await caches.keys(), CACHE)) await caches.delete(name);
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener("message", (event) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === "skip-waiting") void sw.skipWaiting();
  if (data?.type === "version") event.source?.postMessage({ type: "version", version });
});

async function fromCache(keys: string[]): Promise<Response | undefined> {
  const cache = await caches.open(CACHE);
  for (const k of keys) {
    const hit = await cache.match(k);
    if (hit) return hit;
  }
  return undefined;
}

async function navigate(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keys = navigationFallbacks(url.pathname);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS)),
    ]);
    if (res.ok || res.status === 404 || res.status === 410) return res;
    return (await fromCache(keys)) ?? res;
  } catch {
    return (await fromCache(keys)) ?? Response.error();
  }
}

async function staticFile(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

sw.addEventListener("fetch", (event) => {
  const route = routeFor(event.request, sw.location.origin, PRECACHED);
  if (route === "skip") return;
  if (route === "precache") {
    event.respondWith((async () => (await fromCache([new URL(event.request.url).pathname])) ?? fetch(event.request))());
  } else if (route === "navigate") {
    event.respondWith(navigate(event.request));
  } else {
    event.respondWith(staticFile(event.request));
  }
});

sw.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let raw: unknown = null;
      try {
        raw = event.data?.json() ?? null;
      } catch {
        raw = null;
      }
      const n = await buildNotice(raw, store);
      await sw.registration.showNotification(n.title, {
        body: n.body,
        tag: n.tag,
        icon: "/icons/icon-192.png",
        data: { url: n.url },
      });
    })(),
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data as { url?: string } | null)?.url ?? "/app/", sw.location.origin);
  event.waitUntil(
    (async () => {
      const all = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = all.find((c) => new URL(c.url).pathname === target.pathname);
      if (same) {
        await same.focus();
        return;
      }
      await sw.clients.openWindow(target.href);
    })(),
  );
});
