import { execSync } from "node:child_process";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";

// The build id shown in the site footer and used by the service worker cache (live bug 6):
// the commit, so a phone can be checked against /api/v1/health.
const BUILD = (() => {
  const env = process.env.RENDER_GIT_COMMIT ?? process.env.FLARE_BUILD;
  if (env) return env.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return String(Date.now());
  }
})();

/**
 * The copy deck (ICD-12) carries notes for writers: kind, where, owner, sample. Phones need
 * only the text, the `one` form and the variants, so the bundle gets just those (deck.json
 * 85 KB raw; the shipped part is about a third). Keys and strings are unchanged.
 */
/** Website keys the app also shows (the OpenStreetMap credit on the loop page and card). */
const APP_SITE_KEYS = new Set(["site.foot.osm"]);

export function slimDeck(): Plugin {
  return {
    name: "flare-slim-deck",
    enforce: "pre",
    transform(code, id) {
      const path = id.replace(/\\/g, "/");
      const site = path.endsWith("design/prototype/src/lib/copy/deck.json?site");
      if (!site && !path.endsWith("design/prototype/src/lib/copy/deck.json")) return null;
      const deck = JSON.parse(code) as {
        meta: { variants: Record<string, string> };
        strings: Record<string, { text: string; one?: string }>;
      };
      // The website's own lines (site.*, og.*) ship only with the website: #lib/copy/site.ts
      // imports deck.json?site and adds them. The app keeps the few it shows (JS budget).
      const isSite = (k: string) => (k.startsWith("site.") || k.startsWith("og.")) && !APP_SITE_KEYS.has(k);
      const strings = Object.fromEntries(
        Object.entries(deck.strings)
          .filter(([k]) => (site ? isSite(k) : !isSite(k)))
          .map(([k, e]) => [k, e.one ? { text: e.text, one: e.one } : { text: e.text }]),
      );
      // With the ?site query Vite's JSON plugin skips the file, so that one is emitted as a module.
      if (site) return { code: `export default ${JSON.stringify({ strings })};`, map: null };
      return { code: JSON.stringify({ meta: { variants: deck.meta.variants }, strings }), map: null };
    },
  };
}

// SvelteKit 3: options go straight to the plugin (BUG-008).
// SPA routes /app/* and /g/* fall back to 200.html (docs/engineering/briefs/url-map.md, CR-PW3);
// the server serves it for those paths. Dev port 5180, preview 8860 (frontend range).
export default defineConfig({
  plugins: [
    slimDeck(),
    sveltekit({
      adapter: adapter({ fallback: "200.html" }),
      prerender: { handleHttpError: "warn" },
      version: { name: BUILD },
      inlineStyleThreshold: 16384, // website: inline small CSS for first paint (Lighthouse)
    }),
  ],
  server: { port: 5180, strictPort: true, proxy: { "/api": "http://localhost:8787" } },
  preview: { port: 8860, strictPort: true },
});
