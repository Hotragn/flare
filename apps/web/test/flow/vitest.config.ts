import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Frontend flow tests (screen state machines over ICD fakes). The root vitest.config.ts doesn't
// include apps/web/test yet (change request in docs/handoffs/07a-frontend-app.md).
// Run: npx vitest run --config apps/web/test/flow/vitest.config.ts
const root = fileURLToPath(new URL("../../../../", import.meta.url));
export default defineConfig({
  root,
  plugins: [svelte({ compilerOptions: { runes: true } })],
  resolve: { alias: { "#lib": fileURLToPath(new URL("../../src/lib", import.meta.url)) } },
  test: { include: ["apps/web/test/flow/**/*.test.ts"], testTimeout: 20000 },
});
