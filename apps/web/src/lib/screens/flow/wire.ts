// Finds the real phone modules other work packages build (PWA: crypto, store, outbox, live;
// ODAI: conditions, capabilities; MAP: map) and provides them to the flows. Each module lives
// at apps/web/src/lib/{name}/index.ts and exports its ICD object as the default export, as a
// named object, or as a no-argument create* factory. A module that has not landed yet is
// reported by name; crypto, store, outbox and live are essential, the rest are optional.
import { type DepName, type Deps, ESSENTIAL, NotWiredError, provide } from "./deps.ts";
import { pickImpl, REQUIRED } from "./pick.ts";

const found = import.meta.glob(
  ["../../crypto/index.ts", "../../store/index.ts", "../../outbox/index.ts", "../../live/index.ts"],
  { eager: true },
) as Record<string, Record<string, unknown>>;
const foundOdai = import.meta.glob(["../../conditions/index.ts", "../../capabilities/index.ts", "../../map/index.ts"], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const folder: Record<DepName, string> = {
  crypto: "crypto",
  store: "store",
  outbox: "outbox",
  live: "live",
  conditions: "conditions",
  caps: "capabilities",
  maps: "map",
};

let wired: Deps | null = null;

/** Wires once per page. Throws NotWiredError naming every module still missing. */
export function wire(): Deps {
  if (wired) return wired;
  const all = { ...found, ...foundOdai };
  const out: Partial<Record<DepName, unknown>> = {};
  const missing: DepName[] = [];
  for (const name of Object.keys(folder) as DepName[]) {
    const mod = all[`../../${folder[name]}/index.ts`];
    const impl = mod ? pickImpl(mod, REQUIRED[name]) : null;
    out[name] = impl;
    if (!impl && ESSENTIAL.includes(name)) missing.push(name);
  }
  if (missing.length) throw new NotWiredError(missing);
  wired = {
    ...(out as Pick<Deps, DepName>),
    fetch: (...a) => fetch(...a),
    now: () => Date.now(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  provide(wired);
  return wired;
}
