// Wires the real phone modules into the flows (docs/pwa/README.md "How the frontend uses it").
// PWA: crypto, store, outbox, live (on main). ODAI: conditions, capabilities; MAP: map. The
// ODAI and MAP modules are found by path when they land (apps/web/src/lib/{name}/index.ts,
// ICD object as the default export, a named object, or a no-argument create* factory); until
// then the flows hide what needs them.
import type { CapabilitiesIcd, ConditionsIcd, MapIcd } from "@flare/shared/icd/index";
import { flareCrypto } from "#lib/crypto/index.ts";
import { createLive } from "#lib/live/index.ts";
import { createOutbox } from "#lib/outbox/index.ts";
import { createStore } from "#lib/store/index.ts";
import type { GatheringView } from "./api-types.ts";
import { type Deps, provide } from "./deps.ts";
import { pickImpl, REQUIRED } from "./pick.ts";

const optional = import.meta.glob(["../../conditions/index.ts", "../../capabilities/index.ts", "../../map/index.ts"], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const find = <T>(folder: string, methods: string[]): T | null => {
  const mod = optional[`../../${folder}/index.ts`];
  return mod ? (pickImpl(mod, methods) as T | null) : null;
};

let wired: Deps | null = null;

/** Builds the module set once per page and starts the outbox triggers (online, visible, 15 s). */
export function wire(
  opts: { onDropped?: (n: number) => void; onStatus?: (online: boolean, savedAt: string | null) => void } = {},
): Deps {
  if (wired) return wired;
  const store = createStore();
  const outbox = createOutbox({ store, onDropped: opts.onDropped });
  outbox.start();
  const live = createLive({ store, onStatus: (_id, s) => opts.onStatus?.(s.online, s.savedAt) });
  void store.sweep().catch(() => {
    // A failed sweep retries on the next open; expired rows are also skipped on read.
  });
  wired = {
    crypto: flareCrypto,
    store,
    outbox,
    // The live module passes the whole Gathering view it parsed; LiveView types the fields it reads.
    live: live as unknown as Deps["live"] & {
      follow(id: string, f: (v: GatheringView, o: number) => void): () => void;
    },
    conditions: find<ConditionsIcd.Conditions>("conditions", REQUIRED.conditions),
    maps: find<MapIcd.Maps>("map", REQUIRED.maps),
    caps: find<CapabilitiesIcd.CapabilityProbe>("capabilities", REQUIRED.caps),
    fetch: (...a) => fetch(...a),
    now: () => Date.now(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  provide(wired);
  return wired;
}
