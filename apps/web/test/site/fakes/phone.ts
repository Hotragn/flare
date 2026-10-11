// Fakes for ICD-5 (02-interface-control.md section 4): a pass-through crypto that still checks
// the AAD, a Map-backed store, and a scripted fetch that records every request.
import type { Aad, Crypto, GroupRecord, Store } from "@flare/shared/icd/client";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function fakeCrypto(): Crypto {
  const seal = async (_k: CryptoKey, aad: Aad, plain: Uint8Array) =>
    b64(JSON.stringify({ aad, p: Buffer.from(plain).toString("base64url") }));
  const open = async (_k: CryptoKey, aad: Aad, sealed: string) => {
    const o = JSON.parse(unb64(sealed)) as { aad: string; p: string };
    if (o.aad !== aad) throw new Error("wrong aad");
    return new Uint8Array(Buffer.from(o.p, "base64url"));
  };
  return {
    newGroupKey: async () => ({ key: {} as CryptoKey, fragment: "k" }),
    importFragment: async () => ({}) as CryptoKey,
    seal,
    open,
    sealJson: (k, aad, v) => seal(k, aad, new TextEncoder().encode(JSON.stringify(v))),
    openJson: async <T>(k: CryptoKey, aad: Aad, s: string) =>
      JSON.parse(new TextDecoder().decode(await open(k, aad, s))) as T,
    placeHash: async (_k, placeKey) => `h-${b64(placeKey)}`,
  };
}

export function fakeStore(groups: GroupRecord[] = []): Store & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(groups.map((g) => [`g:${g.groupId}`, g]));
  return {
    data,
    group: async (id) => (data.get(`g:${id}`) as GroupRecord | undefined) ?? null,
    saveGroup: async (g) => void data.set(`g:${g.groupId}`, g),
    forget: async (id) => void data.delete(`g:${id}`),
    saveLit: async (id, v) => void data.set(`l:${id}`, v),
    lit: async <T>(id: string) => (data.get(`l:${id}`) as T | undefined) ?? null,
    needs: async <T>() => (data.get("needs") as T | undefined) ?? null,
    saveNeeds: async (n) => void data.set("needs", n),
  };
}

export type Recorded = { url: string; method: string; headers: Record<string, string>; body: string | null };

/** Answers each request with the first route whose prefix matches; throws for "offline". */
export function fakeFetch(routes: Record<string, (r: Recorded) => Response | "offline">) {
  const calls: Recorded[] = [];
  const fn = async (url: string, init: RequestInit = {}) => {
    const r: Recorded = {
      url,
      method: init.method ?? "GET",
      headers: Object.fromEntries(Object.entries((init.headers as Record<string, string>) ?? {})),
      body: typeof init.body === "string" ? init.body : null,
    };
    calls.push(r);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) return new Response("{}", { status: 404 });
    const out = routes[key](r);
    if (out === "offline") throw new TypeError("Failed to fetch");
    return out;
  };
  return { fetch: fn, calls };
}

export const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

export const GROUP: GroupRecord = {
  groupId: "11111111-1111-4111-8111-111111111111",
  key: {} as CryptoKey,
  memberId: "22222222-2222-4222-8222-222222222222",
  token: "tok_abc",
  names: { "22222222-2222-4222-8222-222222222222": "Amor", "33333333-3333-4333-8333-333333333333": "Bea" },
};
