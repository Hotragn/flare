// The phone modules every screen flow uses, typed by the frozen ICDs. Flows never import a
// module directly: they take a Deps object, so tests pass fakes (apps/web/test/fakes/) and the
// app passes the real modules found by wire.ts.
import type { CapabilitiesIcd, ClientIcd, ConditionsIcd, MapIcd } from "@flare/shared/icd/index";
import type { GatheringView } from "./api-types.ts";

/** ICD-5 Store plus the two FlareStore methods FE needs (CR-PW4 proposes adding them to the ICD). */
export type StoreExtras = ClientIcd.Store & {
  fragment(groupId: string): Promise<string | null>;
  rememberGathering(gatheringId: string, groupId: string): Promise<void>;
};

export type Deps = {
  crypto: ClientIcd.Crypto; // ICD-5, PWA
  store: StoreExtras; // ICD-5, PWA
  outbox: ClientIcd.Outbox; // ICD-5, PWA
  live: ClientIcd.Live<GatheringView>; // ICD-5, PWA
  // Optional: until they land the flows hide what needs them (no condition link, no walk
  // time or access line, capabilities read as "unknown").
  conditions: ConditionsIcd.Conditions | null; // ICD-7, ODAI
  maps: MapIcd.Maps | null; // ICD-6, MAP
  caps: CapabilitiesIcd.CapabilityProbe | null; // ICD-8, ODAI
  /** Reads (GET) go straight to fetch; writes go through the outbox. */
  fetch: typeof fetch;
  /** Device clock in ms. Flows add the server offset from each view (BR-TIME-1). */
  now: () => number;
  /** IANA zone of this phone (BR-TIME-2). */
  tz: string;
};

export const DEP_NAMES = ["crypto", "store", "outbox", "live", "conditions", "maps", "caps"] as const;
export type DepName = (typeof DEP_NAMES)[number];
export const ESSENTIAL: DepName[] = ["crypto", "store", "outbox", "live"];

let current: Deps | null = null;

export function provide(d: Deps): void {
  current = d;
}

export class NotWiredError extends Error {
  readonly missing: DepName[];
  constructor(missing: DepName[]) {
    super(`phone modules not wired: ${missing.join(", ")}`);
    this.missing = missing;
    this.name = "NotWiredError";
  }
}

export function deps(): Deps {
  if (!current) throw new NotWiredError([...DEP_NAMES]);
  return current;
}
