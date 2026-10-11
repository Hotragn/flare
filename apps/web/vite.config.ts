import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// SvelteKit 3: options go straight to the plugin (BUG-008).
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ fallback: "404.html" }),
      prerender: { handleHttpError: "warn" },
      inlineStyleThreshold: 16384,
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8787" } },
});
