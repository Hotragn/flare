// Finds the ICD-5 store and crypto modules (PWA's apps/web/src/lib/store and lib/crypto) at
// run time. A glob, not a static import, so this area builds before PWA's branch lands; once
// it lands the same code finds the real modules. A module counts when it exports an object
// with the ICD-5 methods, or a zero-argument factory that returns one.
import type { Crypto, GroupRecord, Store } from "@flare/shared/icd/client";

const loaders = import.meta.glob(["/src/lib/store/index.ts", "/src/lib/crypto/index.ts"]);

const STORE_METHODS = ["group", "forget", "needs", "saveNeeds"] as const;
const CRYPTO_METHODS = ["openJson", "sealJson", "importFragment"] as const;

function hasAll(v: unknown, names: readonly string[]): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return names.every((n) => typeof o[n] === "function");
}

/** Exported for tests: picks the ICD object out of a module's exports. */
export async function pick<T>(mod: Record<string, unknown>, names: readonly string[]): Promise<T | null> {
  if (hasAll(mod, names)) return mod as T;
  for (const v of Object.values(mod)) if (hasAll(v, names)) return v as T;
  for (const [k, v] of Object.entries(mod)) {
    if (typeof v !== "function" || v.length !== 0 || !/^(create|open|make|get)/.test(k)) continue;
    const made = await (v as () => unknown)();
    if (hasAll(made, names)) return made as T;
  }
  return null;
}

async function load<T>(path: string, names: readonly string[]): Promise<T | null> {
  const loader = loaders[path];
  if (!loader) return null;
  return pick<T>((await loader()) as Record<string, unknown>, names);
}

let cached: Promise<{ store: Store | null; crypto: Crypto | null }> | null = null;

export function phoneModules(): Promise<{ store: Store | null; crypto: Crypto | null }> {
  cached ??= Promise.all([
    load<Store>("/src/lib/store/index.ts", STORE_METHODS),
    load<Crypto>("/src/lib/crypto/index.ts", CRYPTO_METHODS),
  ]).then(([store, crypto]) => ({ store, crypto }));
  return cached;
}

export { CRYPTO_METHODS, STORE_METHODS };

/** Group id from `?g=`: a phone-made UUID v4 (ADR-0018), nothing personal. */
export function groupIdFrom(url: { searchParams: { get(k: string): string | null } }): string | null {
  const g = url.searchParams.get("g");
  return g && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(g) ? g : null;
}

export const idemKey = () => crypto.randomUUID();

/** The group named by `?g=` (else this phone's group), with this phone's modules, or null. */
export async function openGroup(
  url: Parameters<typeof groupIdFrom>[0],
): Promise<{ store: Store; crypto: Crypto; group: GroupRecord } | null> {
  const { store, crypto: c } = await phoneModules();
  if (!store || !c) return null;
  // No `?g=` (the menu before the host's group has loaded): this phone's own group, the first
  // one it joined. Each field-test phone is in one group.
  let id = groupIdFrom(url);
  if (!id) {
    const ids = await (store as Store & { groupIds?: () => Promise<string[]> }).groupIds?.().catch(() => []);
    id = ids?.[0] ?? null;
  }
  if (!id) return null;
  const group = await store.group(id).catch(() => null);
  return group ? { store, crypto: c, group } : null;
}
