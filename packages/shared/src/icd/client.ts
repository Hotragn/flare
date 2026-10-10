// ICD-5: phone-side modules that frontend, PWA and the service worker share (work package
// PWA). Frozen v1. Keys never leave IndexedDB except into the link fragment (ADR-0008).
import type { Iso } from "./engine.ts";

/** AAD names one field of one record (ADR-0008 table). */
export type Aad =
  | `g:${string}`
  | `p:${string}`
  | `n:${string}`
  | `m:${string}:${string}`
  | `s:${string}:${string}`
  | `h:${string}`
  | `l:${string}`;

export interface Crypto {
  newGroupKey(): Promise<{ key: CryptoKey; fragment: string }>; // fragment = base64url raw key
  importFragment(fragment: string): Promise<CryptoKey>; // throws on a bad or missing key (SRS-RES-2)
  seal(key: CryptoKey, aad: Aad, plain: Uint8Array): Promise<string>; // base64url(nonce ‖ ct)
  open(key: CryptoKey, aad: Aad, sealed: string): Promise<Uint8Array>;
  sealJson(key: CryptoKey, aad: Aad, value: unknown): Promise<string>;
  openJson<T>(key: CryptoKey, aad: Aad, sealed: string): Promise<T>;
  placeHash(key: CryptoKey, placeKey: string): Promise<string>; // HMAC under HKDF(group key, "flare place v1")
}

export type OutboxItem = {
  idemKey: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body: unknown;
  recorded_at: Iso;
  attempts: number;
};

export interface Outbox {
  /** Stores first, then sends; resolves with the server response or null if queued. */
  send<T>(item: Omit<OutboxItem, "idemKey" | "recorded_at" | "attempts">): Promise<T | null>;
  flush(): Promise<{ sent: number; dropped: number; left: number }>;
  size(): Promise<number>;
}

export type GroupRecord = {
  groupId: string;
  key: CryptoKey;
  memberId: string;
  token: string;
  names: Record<string, string>;
};

export interface Store {
  group(groupId: string): Promise<GroupRecord | null>;
  saveGroup(g: GroupRecord): Promise<void>;
  forget(groupId: string): Promise<void>;
  saveLit(gatheringId: string, data: unknown): Promise<void>; // SRS-OFF-1
  lit<T>(gatheringId: string): Promise<T | null>;
  needs<T>(): Promise<T | null>;
  saveNeeds(n: unknown): Promise<void>;
}

/** Live view: SSE plus a 30 s poll, server-time offset (07-offline-sync-and-ai.md A4). */
export interface Live<View> {
  follow(gatheringId: string, onView: (v: View, offsetMs: number) => void): () => void;
}
