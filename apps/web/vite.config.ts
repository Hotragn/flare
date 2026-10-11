import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";

/**
 * The copy deck (ICD-12) carries notes for writers: kind, where, owner, sample. Phones need
 * only the text, the `one` form and the variants, so the bundle gets just those (deck.json
 * 85 KB raw; the shipped part is about a third). Keys and strings are unchanged.
 */
function slimDeck(): Plugin {
  return {
    name: "flare-slim-deck",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").endsWith("design/prototype/src/lib/copy/deck.json")) return null;
      const deck = JSON.parse(code) as {
        meta: { variants: Record<string, string> };
        strings: Record<string, { text: string; one?: string }>;
      };
      const strings = Object.fromEntries(
        Object.entries(deck.strings).map(([k, e]) => [k, e.one ? { text: e.text, one: e.one } : { text: e.text }]),
      );
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
    // inlineStyleThreshold: the website's CSS goes inline, saving about 300 ms per
    // render-blocking stylesheet on mobile (docs/website/README.md, Lighthouse 59 to 98).
    sveltekit({
      adapter: adapter({ fallback: "200.html" }),
      prerender: { handleHttpError: "warn" },
      inlineStyleThreshold: 16384,
    }),
  ],
  server: { port: 5180, strictPort: true, proxy: { "/api": "http://localhost:8787" } },
  preview: { port: 8860, strictPort: true },
});
