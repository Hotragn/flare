import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/server/test/**/*.test.ts",
      "apps/hub/test/**/*.test.ts",
      "apps/web/test/ai/**/*.test.ts",
      "scripts/test/**/*.test.ts",
      "apps/web/test/pwa/**/*.test.ts",
      "evals/test/**/*.test.ts",
    ],
    testTimeout: 20000,
  },
});
