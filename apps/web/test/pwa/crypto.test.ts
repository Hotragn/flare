import { describe, expect, it } from "vitest";
import {
  aad,
  flareCrypto as c,
  fragmentOf,
  keyFromHash,
  linkKey,
  MissingKeyError,
  OpenError,
} from "../../src/lib/crypto/index.ts";

const G = "0b6f5f7e-3c1a-4c55-9a4e-2d1f7a9c8e01";

describe("PW1 crypto (ADR-0008)", () => {
  it("SRS-ID-1: makes a 256-bit key as a 43-char base64url fragment", async () => {
    const { key, fragment } = await c.newGroupKey();
    expect(fragment).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(key.extractable).toBe(false);
    expect(key.algorithm.name).toBe("AES-GCM");
    expect(fragmentOf(key)).toBe(fragment);
  });

  it("SRS-SEC-3: seal and open round trip; fresh nonce per seal", async () => {
    const { key } = await c.newGroupKey();
    const a = await c.sealJson(key, aad.gathering(G), { hi: "there" });
    const b = await c.sealJson(key, aad.gathering(G), { hi: "there" });
    expect(a).not.toBe(b);
    expect(a.slice(0, 16)).not.toBe(b.slice(0, 16));
    expect(await c.openJson(key, aad.gathering(G), a)).toEqual({ hi: "there" });
  });

  it("ADR-0008 AAD: a field moved to another place does not open", async () => {
    const { key } = await c.newGroupKey();
    const s = await c.seal(key, aad.notice(G), new Uint8Array([1, 2, 3]));
    await expect(c.open(key, aad.gathering(G), s)).rejects.toBeInstanceOf(OpenError);
    await expect(c.open(key, aad.notice("other"), s)).rejects.toBeInstanceOf(OpenError);
    expect(await c.open(key, aad.notice(G), s)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("SRS-RES-2: a wrong key fails to open", async () => {
    const one = await c.newGroupKey();
    const two = await c.newGroupKey();
    const s = await c.sealJson(one.key, aad.photo(G), "x");
    await expect(c.openJson(two.key, aad.photo(G), s)).rejects.toBeInstanceOf(OpenError);
    await expect(c.open(one.key, aad.photo(G), "AAAA")).rejects.toBeInstanceOf(OpenError);
    await expect(c.open(one.key, aad.photo(G), "not base64!")).rejects.toBeInstanceOf(OpenError);
  });

  it("SRS-RES-2: a missing or bad fragment throws MissingKeyError", async () => {
    for (const bad of ["", "abc", "A".repeat(42), `${"A".repeat(42)}!`, "B".repeat(44)]) {
      await expect(c.importFragment(bad)).rejects.toBeInstanceOf(MissingKeyError);
    }
  });

  it("SRS-ID-2: the importer opens what the creator sealed", async () => {
    const host = await c.newGroupKey();
    const s = await c.sealJson(host.key, aad.memberName(G, "m1"), "Fuego");
    const friend = await c.importFragment(keyFromHash(`#k=${host.fragment}`) ?? "");
    expect(await c.openJson(friend, aad.memberName(G, "m1"), s)).toBe("Fuego");
    expect(keyFromHash("#via=tg")).toBeNull();
  });

  it("ADR-0008 place hash: equal places match across phones, 43 chars, keyed by group", async () => {
    const host = await c.newGroupKey();
    const friend = await c.importFragment(host.fragment);
    const other = await c.newGroupKey();
    const h1 = await c.placeHash(host.key, "node/123");
    expect(h1).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await c.placeHash(friend, "node/123")).toBe(h1);
    expect(await c.placeHash(host.key, "node/124")).not.toBe(h1);
    expect(await c.placeHash(other.key, "node/123")).not.toBe(h1);
  });

  it("placeHash works on a key re-linked after a reload", async () => {
    const host = await c.newGroupKey();
    const copy = structuredClone(host.key);
    await expect(c.placeHash(copy, "x")).rejects.toBeInstanceOf(MissingKeyError);
    linkKey(copy, host.fragment);
    expect(await c.placeHash(copy, "x")).toBe(await c.placeHash(host.key, "x"));
  });
});
