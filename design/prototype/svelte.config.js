import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter({ fallback: "404.html" }),
    alias: { $system: "../system", $brand: "../../brand" },
    prerender: { handleHttpError: "warn" },
  },
};
