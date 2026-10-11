// What the service worker precaches and how it answers each request (PW5, ADR-0010).
// Pure functions, so the rules are unit tested without a browser.

export const CACHE_PREFIX = "flare-";
export const MAP_PACK = "/maps/fairlane.json";
/** Shell pages for SPA routes, in order of preference (adapter-static fallback). */
export const SHELLS = ["/200.html", "/404.html", "/"];
export const NAV_TIMEOUT_MS = 4000;

/** Static files not worth phone storage: splash images (iOS reads them at install time),
 * the device-check kit, large or duplicate icons, and source maps. */
// Scenic photos and the simulation replay are decorative or heavy: loaded when shown, never
// precached (backlog #6). /scenic/ is an earlier output folder kept off the cache too.
const SKIP = [
  /^\/scenery\//,
  /^\/scenic\//,
  /^\/sim\//,
  /^\/splash\//,
  /^\/check\//,
  /^\/icons\/icon-(1024|384|256)\.png$/,
  /\.map$/,
  /^\/\.well-known\//,
];

export function precacheList(build: string[], files: string[], prerendered: string[]): string[] {
  const keep = files.filter((f) => !SKIP.some((re) => re.test(f)));
  return [...new Set([...build, ...keep, ...prerendered])];
}

export type Route = "skip" | "precache" | "navigate" | "static";

/** Never touch the API, the hub socket or another origin: they must reach the network. */
export function routeFor(
  req: { method: string; mode: string; url: string },
  origin: string,
  precached: ReadonlySet<string>,
): Route {
  if (req.method !== "GET") return "skip";
  const url = new URL(req.url);
  if (url.origin !== origin) return "skip";
  if (url.pathname.startsWith("/api/") || url.pathname === "/hub" || url.pathname.startsWith("/hub/")) return "skip";
  if (precached.has(url.pathname)) return "precache";
  if (req.mode === "navigate") return "navigate";
  if (url.pathname === MAP_PACK || url.pathname.startsWith("/_app/") || url.pathname.startsWith("/icons/"))
    return "static";
  return "skip";
}

/** Cache keys to try for an offline navigation, best first. */
export function navigationFallbacks(pathname: string): string[] {
  const out = [pathname];
  if (!pathname.endsWith("/")) out.push(`${pathname}/`);
  if (pathname.endsWith("/") && pathname !== "/") out.push(pathname.slice(0, -1));
  if (pathname.endsWith("/index.html")) out.push(pathname.slice(0, -"index.html".length));
  return [...out, ...SHELLS];
}

/** Old caches to delete on activate. */
export function staleCaches(names: string[], current: string): string[] {
  return names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current);
}
