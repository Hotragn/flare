import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// SvelteKit 3: options go straight to the plugin (BUG-008).
// SPA routes /app/* and /g/* fall back to 200.html (docs/engineering/briefs/url-map.md);
// the server serves it for those paths. Dev port 5180, preview 8860 (frontend range).
export default defineConfig({
  plugins: [sveltekit({ adapter: adapter({ fallback: "200.html" }), prerender: { handleHttpError: "warn" } })],
  server: { port: 5180, strictPort: true, proxy: { "/api": "http://localhost:8787" } },
  preview: { port: 8860, strictPort: true },
});
