import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/server/test/**/*.test.ts",
      "apps/hub/test/**/*.test.ts",
      "scripts/test/**/*.test.ts",
      "apps/web/test/pwa/**/*.test.ts",
    ],
    testTimeout: 20000,
  },
});
