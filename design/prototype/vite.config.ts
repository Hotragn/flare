import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { defineConfig } from "vite";

// SvelteKit 3: options go straight to the plugin, with no `kit` namespace
// (svelte.config.js is no longer read). See BUGLOG BUG-008.
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ fallback: "404.html" }),
      prerender: { handleHttpError: "warn" },
    }),
  ],
});
