// INT1: the push sender against a fake push service that decrypts what it gets (RFC 8291)
// and checks the VAPID header (RFC 8292). Payload shape per asyncapi.yaml `push`.
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, randomUUID, verify } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import webpush from "web-push";
import { type Db, memoryDb, migrate } from "../../src/db/db.ts";
import { createPush, MAX_PAYLOAD, noticePayload, type PushNotice, TTL_S } from "../../src/push/index.ts";

type Got = { path: string; headers: http.IncomingHttpHeaders; body: Buffer };
const got: Got[] = [];
const statusFor = new Map<string, number>();
let server: http.Server;
let base = "";
let db: Db;
const vapid = { ...webpush.generateVAPIDKeys(), subject: "mailto:test@flare.test" };

/** A browser's subscription: P-256 key pair and a 16-byte auth secret. */
function browser() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, auth, p256dh: ecdh.getPublicKey().toString("base64url"), authB64: auth.toString("base64url") };
}
type Browser = ReturnType<typeof browser>;

/** RFC 8291 section 3.4 + RFC 8188: what the browser does to read a push. */
function decrypt(b: Browser, body: Buffer): string {
  const salt = body.subarray(0, 16);
  const rs = body.readUInt32BE(16);
  const idlen = body[20] as number;
  const asPublic = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  expect(rs).toBeGreaterThanOrEqual(ct.length);
  const shared = b.ecdh.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), b.ecdh.getPublicKey(), asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, b.auth, info, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1;
  while (plain[end] === 0) end--;
  expect(plain[end]).toBe(2); // last-record delimiter
  return plain.subarray(0, end).toString("utf8");
}

/** RFC 8292: the JWT in `Authorization: vapid t=..., k=...` is ES256-signed by our key. */
function checkVapid(h: http.IncomingHttpHeaders, audience: string) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(String(h.authorization));
  expect(m).not.toBeNull();
  const [head, payload, sig] = String(m?.[1]).split(".");
  expect(m?.[2]).toBe(vapid.publicKey);
  const claims = JSON.parse(Buffer.from(payload as string, "base64url").toString());
  expect(claims.aud).toBe(audience);
  expect(claims.sub).toBe(vapid.subject);
  const raw = Buffer.from(vapid.publicKey, "base64url");
  const key = createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: raw.subarray(1, 33).toString("base64url"),
      y: raw.subarray(33).toString("base64url"),
    },
    format: "jwk",
  });
  const ok = verify(
    "sha256",
    Buffer.from(`${head}.${payload}`),
    { key, dsaEncoding: "ieee-p1363" },
    Buffer.from(sig as string, "base64url"),
  );
  expect(ok).toBe(true);
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    got.push({ path: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
    res.writeHead(statusFor.get(req.url ?? "") ?? 201);
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  db = await memoryDb();
  await migrate(db);
}, 60_000);
afterAll(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});

let groupId: string;
let gid: string;
let members: { id: string; b: Browser }[];
beforeEach(async () => {
  got.length = 0;
  statusFor.clear();
  await db.query("delete from groups");
  groupId = randomUUID();
  gid = randomUUID();
  await db.query("insert into groups (id) values ($1)", [groupId]);
  members = [];
  for (let i = 0; i < 3; i++) {
    const id = randomUUID();
    const b = browser();
    await db.query("insert into members (id, group_id, name_ct, write_token_hash) values ($1, $2, '\\x01', '\\x02')", [
      id,
      groupId,
    ]);
    await db.query("insert into push_subscriptions (member_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)", [
      id,
      `${base}/push/${i}`,
      b.p256dh,
      b.authB64,
    ]);
    members.push({ id, b });
  }
  await db.query(
    `insert into gatherings (id, group_id, kind, state, short_code, host_member_id, quorum, tz, sealed, notice_ct,
       chosen_set, start_at, expires_at)
     values ($1, $2, 'plan', 'lit', 'K7Q2M', $3, 2, 'America/Detroit', '\\x03', $4, $5::uuid[], '2026-10-11T15:00:00Z',
       now() + interval '5 hours')`,
    [gid, groupId, members[0]?.id, Buffer.from("sealed-notice-bytes"), [members[0]?.id, members[1]?.id]],
  );
}, 60_000);

const push = () => createPush({ db, vapid });

describe("Web Push sender (INT1, SRS-IF-3, SRS-LIT-1)", () => {
  it("SRS-LIT-1: lit to the set: payload decrypts (RFC 8291) to the contract shape", async () => {
    const r = await push().notify(gid, { event: "lit", to: "set" });
    expect(r).toEqual({ sent: 2, removed: 0, failed: 0 });
    expect(got.map((g) => g.path).sort()).toEqual(["/push/0", "/push/1"]);
    for (const g of got) {
      const i = Number(g.path.split("/").pop());
      const body = JSON.parse(decrypt(members[i]?.b as Browser, g.body)) as PushNotice;
      expect(body).toEqual({
        v: 1,
        g: gid,
        kind: "plan",
        event: "lit",
        notice_ct: Buffer.from("sealed-notice-bytes").toString("base64url"),
      });
      expect(
        Object.keys(body).every((k) => ["v", "g", "kind", "event", "label", "step", "at", "notice_ct"].includes(k)),
      ).toBe(true);
      expect(g.headers.ttl).toBe(String(TTL_S));
      expect(g.headers.urgency).toBe("high");
      expect(g.headers["content-encoding"]).toBe("aes128gcm");
      checkVapid(g.headers, base);
    }
  });
  it("plan_on carries the start time; ember carries the label; urgency normal off lit", async () => {
    await push().notify(gid, { event: "plan_on", to: [members[2]?.id as string] });
    const on = JSON.parse(decrypt(members[2]?.b as Browser, got[0]?.body as Buffer));
    expect(on.at).toBe("2026-10-11T15:00:00.000Z");
    got.length = 0;
    await push().notify(gid, { event: "plan_ember", to: "all", label: "step:2", step: 2 });
    expect(got).toHaveLength(3);
    const em = JSON.parse(decrypt(members[0]?.b as Browser, got.find((g) => g.path === "/push/0")?.body as Buffer));
    expect(em).toMatchObject({ event: "plan_ember", label: "step:2", step: 2 });
    expect(got[0]?.headers.urgency).toBe("normal");
  });
  it("deletes a subscription on 404 or 410 and keeps it on 500", async () => {
    statusFor.set("/push/0", 410);
    statusFor.set("/push/1", 404);
    statusFor.set("/push/2", 500);
    const r = await push().notify(gid, { event: "gone", to: "all" });
    expect(r).toEqual({ sent: 0, removed: 2, failed: 1 });
    const left = await db.query<{ member_id: string }>("select member_id from push_subscriptions");
    expect(left.rows.map((x) => x.member_id)).toEqual([members[2]?.id]);
  });
  it("never sends to a member of another group even if listed", async () => {
    const other = randomUUID();
    const og = randomUUID();
    await db.query("insert into groups (id) values ($1)", [og]);
    await db.query("insert into members (id, group_id) values ($1, $2)", [other, og]);
    await db.query("insert into push_subscriptions values ($1, $2, $3, $4)", [
      other,
      `${base}/push/x`,
      browser().p256dh,
      "AAAAAAAAAAAAAAAAAAAAAA",
    ]);
    const r = await push().notify(gid, { event: "lit", to: [other] });
    expect(r.sent).toBe(0);
    expect(got).toHaveLength(0);
  });
  it("an unknown gathering sends nothing; a network error counts as failed", async () => {
    expect(await push().notify(randomUUID(), { event: "lit", to: "all" })).toEqual({ sent: 0, removed: 0, failed: 0 });
    await db.query("update push_subscriptions set endpoint = 'http://127.0.0.1:1/closed'");
    const r = await push().notify(gid, { event: "lit", to: "set" });
    expect(r).toEqual({ sent: 0, removed: 0, failed: 2 });
  });
  it("keeps the payload under the 4 KB Web Push limit with the largest notice_ct", () => {
    const row = {
      id: gid,
      kind: "plan" as const,
      group_id: groupId,
      chosen_set: [],
      notice_ct: randomBytes(2100), // 2800 base64url characters, the contract maximum
      start_at: new Date(),
    };
    const p = noticePayload(row, { event: "plan_ember", to: "all", label: "step:4", step: 4 });
    expect(p.notice_ct?.length).toBe(2800);
    expect(Buffer.byteLength(JSON.stringify(p))).toBeLessThanOrEqual(MAX_PAYLOAD);
    expect(
      noticePayload({ ...row, notice_ct: randomBytes(2200) }, { event: "lit", to: "all" }).notice_ct,
    ).toBeUndefined();
  });
});
