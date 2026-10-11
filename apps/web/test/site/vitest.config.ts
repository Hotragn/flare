// Website and FE6 tests: `npx vitest run --config apps/web/test/site/vitest.config.ts`.
// The root vitest.config.ts doesn't include apps/web/test yet; the include line is a change
// request in docs/handoffs/07c-website.md.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { slimDeck } from "../../vite.config.ts";

const web = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: web,
  plugins: [slimDeck()], // #lib/copy/site.ts imports deck.json?site
  test: { include: ["test/site/**/*.test.ts"], testTimeout: 20000 },
});
