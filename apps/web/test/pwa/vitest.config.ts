import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// PWA unit tests. The root vitest.config.ts doesn't include apps/web/test yet (change request
// in docs/handoffs/07b-pwa-offline.md). Run: npx vitest run --config apps/web/test/pwa/vitest.config.ts
const root = fileURLToPath(new URL("../../../../", import.meta.url));
export default defineConfig({
  root,
  test: { include: ["apps/web/test/pwa/**/*.test.ts"], testTimeout: 20000 },
});
