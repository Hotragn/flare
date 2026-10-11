// Browser harness for the PWA end-to-end test: exposes the real phone modules on window so
// Playwright can drive them on the app's origin (same IndexedDB as the service worker).
// Test code only; built by offline.ts with Vite and served under /__pwa/.
import { aad, flareCrypto } from "../../../src/lib/crypto/index.ts";
import { createLive } from "../../../src/lib/live/index.ts";
import { createOutbox } from "../../../src/lib/outbox/index.ts";
import { createStore } from "../../../src/lib/store/index.ts";

const store = createStore();
const outbox = createOutbox({ store });
const live = createLive({ store });

(globalThis as Record<string, unknown>).pwa = { aad, crypto: flareCrypto, store, outbox, live };
document.body.dataset.ready = "1";
