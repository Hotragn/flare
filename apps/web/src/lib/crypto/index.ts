// ICD-5 crypto (PW1): the group key lives in the link fragment and in IndexedDB, never on the
// server (ADR-0008, SRS-ID-1, SRS-ID-2). AES-256-GCM, a fresh 96-bit nonce per seal, nonce
// first, base64url (SRS-CRE-6, SRS-SEC-3). The AAD binds each ciphertext to its field.
import type { ClientIcd } from "@flare/shared/icd/index";

type Aad = ClientIcd.Aad;

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const PLACE_INFO = "flare place v1";
const enc = new TextEncoder();
const dec = new TextDecoder();

/** Thrown when a link has no key or a key that can't be one (SRS-RES-2). */
export class MissingKeyError extends Error {
  constructor() {
    super("missing or bad group key");
    this.name = "MissingKeyError";
  }
}

/** Thrown when a sealed field doesn't open: wrong key, wrong AAD, or damaged text. */
export class OpenError extends Error {
  constructor() {
    super("sealed field did not open");
    this.name = "OpenError";
  }
}

export function toBase64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new TypeError("not base64url");
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** The key from a location hash such as "#k=abc" (other hash params are ignored). */
export function keyFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("k");
}

/** Raw key bytes from a fragment, or MissingKeyError. */
function rawFromFragment(fragment: string | null | undefined): Uint8Array<ArrayBuffer> {
  if (!fragment || fragment.length !== 43) throw new MissingKeyError();
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64url(fragment);
  } catch {
    throw new MissingKeyError();
  }
  if (raw.length !== KEY_BYTES || toBase64url(raw) !== fragment) throw new MissingKeyError();
  return raw;
}

// placeHash needs HKDF over the raw key, and an AES-GCM CryptoKey can't be used for HKDF.
// Each key we make or import is linked here to its HMAC key. Keys loaded back from IndexedDB
// are new objects, so the store calls linkKey() with the saved fragment.
const hmacKeys = new WeakMap<CryptoKey, Promise<CryptoKey>>();
const fragments = new WeakMap<CryptoKey, string>();

async function hmacKeyFrom(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(PLACE_INFO) },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
}

async function aesKeyFrom(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Ties a key (for example one read back from IndexedDB) to its fragment. */
export function linkKey(key: CryptoKey, fragment: string): void {
  const raw = rawFromFragment(fragment);
  fragments.set(key, fragment);
  hmacKeys.set(key, hmacKeyFrom(raw));
}

/** The fragment a key was made or imported from, for a new link in the same group. */
export function fragmentOf(key: CryptoKey): string | null {
  return fragments.get(key) ?? null;
}

async function newGroupKey(): Promise<{ key: CryptoKey; fragment: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const fragment = toBase64url(raw);
  const key = await aesKeyFrom(raw);
  linkKey(key, fragment);
  raw.fill(0);
  return { key, fragment };
}

async function importFragment(fragment: string): Promise<CryptoKey> {
  const raw = rawFromFragment(fragment);
  const key = await aesKeyFrom(raw);
  linkKey(key, fragment);
  raw.fill(0);
  return key;
}

async function seal(key: CryptoKey, aad: Aad, plain: Uint8Array): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: enc.encode(aad) },
      key,
      new Uint8Array(plain),
    ),
  );
  const out = new Uint8Array(NONCE_BYTES + ct.length);
  out.set(nonce, 0);
  out.set(ct, NONCE_BYTES);
  return toBase64url(out);
}

async function open(key: CryptoKey, aad: Aad, sealed: string): Promise<Uint8Array> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromBase64url(sealed);
  } catch {
    throw new OpenError();
  }
  if (bytes.length < NONCE_BYTES + TAG_BYTES) throw new OpenError();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, NONCE_BYTES), additionalData: enc.encode(aad) },
      key,
      bytes.subarray(NONCE_BYTES),
    );
    return new Uint8Array(plain);
  } catch {
    throw new OpenError();
  }
}

async function sealJson(key: CryptoKey, aad: Aad, value: unknown): Promise<string> {
  return seal(key, aad, enc.encode(JSON.stringify(value)));
}

async function openJson<T>(key: CryptoKey, aad: Aad, sealed: string): Promise<T> {
  const plain = await open(key, aad, sealed);
  try {
    return JSON.parse(dec.decode(plain)) as T;
  } catch {
    throw new OpenError();
  }
}

async function placeHash(key: CryptoKey, placeKey: string): Promise<string> {
  const hmac = hmacKeys.get(key);
  if (!hmac) throw new MissingKeyError();
  const mac = await crypto.subtle.sign("HMAC", await hmac, enc.encode(placeKey));
  return toBase64url(new Uint8Array(mac));
}

/** AAD builders, one per row of the ADR-0008 table. */
export const aad = {
  gathering: (gatheringId: string): Aad => `g:${gatheringId}`,
  photo: (gatheringId: string): Aad => `p:${gatheringId}`,
  notice: (gatheringId: string): Aad => `n:${gatheringId}`,
  memberName: (groupId: string, memberId: string): Aad => `m:${groupId}:${memberId}`,
  spark: (groupId: string, sparkId: string): Aad => `s:${groupId}:${sparkId}`,
  hotspots: (groupId: string): Aad => `h:${groupId}`,
  liveLocation: (gatheringId: string): Aad => `l:${gatheringId}`,
};

export const flareCrypto: ClientIcd.Crypto = { newGroupKey, importFragment, seal, open, sealJson, openJson, placeHash };
export default flareCrypto;
