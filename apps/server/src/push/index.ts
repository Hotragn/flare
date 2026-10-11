// createPush(deps): the Web Push sender (INT1, SRS-IF-3, SRS-LIT-1, ADR-0014).
// Payload per asyncapi.yaml channel `push` (message `notice`), encrypted to each
// subscription with RFC 8291 (aes128gcm) and signed with VAPID (RFC 8292) by web-push,
// then sent with fetch. TTL 600 s; urgency high for lit and plan_on. A 404 or 410 from
// the push service deletes the subscription. Logs counts only: never endpoints, member
// ids or payloads.
import webpush from "web-push";
import type { Db } from "../db/db.ts";
import { log } from "../log.ts";

export type PushEvent = "lit" | "ember" | "plan_on" | "plan_ember" | "plan_smaller" | "still_coming" | "gone";
/** The engine's push effect (ICD-1, packages/shared/src/icd/engine.ts). */
export type PushEffect = { event: PushEvent; to: "set" | "all" | string[]; label?: string; step?: number };

/** asyncapi.yaml components.messages.pushNotice.payload */
export type PushNotice = {
  v: 1;
  g: string;
  kind: "flare" | "plan";
  event: PushEvent;
  label?: string;
  step?: number;
  at?: string;
  notice_ct?: string;
};

export type Vapid = { publicKey: string; privateKey: string; subject: string };

export type PushDeps = {
  db: Db;
  vapid: Vapid;
  /** HTTP client for the push service; default global fetch. */
  fetch?: typeof fetch;
  ttl?: number;
};

export const TTL_S = 600;
/** Web Push carries at most 4096 bytes; aes128gcm adds 103 (header 86, tag 16, delimiter 1). */
export const MAX_PAYLOAD = 3993;

type Target = { member_id: string; endpoint: string; p256dh: string; auth: string };
export type PushRow = {
  id: string;
  kind: "flare" | "plan";
  group_id: string;
  chosen_set: string[];
  notice_ct: Buffer | Uint8Array;
  start_at: Date | null;
};
export type PushResult = { sent: number; removed: number; failed: number };

/** Builds the contract payload; drops notice_ct if it would push the body past the limit. */
export function noticePayload(row: PushRow, effect: PushEffect): PushNotice {
  const p: PushNotice = { v: 1, g: row.id, kind: row.kind, event: effect.event };
  if (effect.label) p.label = effect.label;
  if (effect.step) p.step = effect.step;
  if (row.kind === "plan" && row.start_at && ["plan_on", "plan_ember"].includes(effect.event))
    p.at = new Date(row.start_at).toISOString();
  const ct = Buffer.from(row.notice_ct).toString("base64url");
  if (ct.length <= 2800) p.notice_ct = ct;
  // Without notice_ct the service worker shows the fallback notice (asyncapi `push`).
  if (Buffer.byteLength(JSON.stringify(p)) > MAX_PAYLOAD) delete p.notice_ct;
  return p;
}

export function createPush(deps: PushDeps) {
  const http = deps.fetch ?? fetch;
  const vapidDetails = {
    subject: deps.vapid.subject,
    publicKey: deps.vapid.publicKey,
    privateKey: deps.vapid.privateKey,
  };

  async function targets(row: PushRow, to: PushEffect["to"]): Promise<Target[]> {
    let members: string[];
    if (to === "all")
      members = (
        await deps.db.query<{ id: string }>("select id from members where group_id = $1", [row.group_id])
      ).rows.map((m) => m.id);
    else if (to === "set") members = row.chosen_set;
    else members = to;
    if (!members.length) return [];
    const r = await deps.db.query<Target>(
      `select s.member_id, s.endpoint, s.p256dh, s.auth from push_subscriptions s
       join members m on m.id = s.member_id
       where s.member_id = any($1::uuid[]) and m.group_id = $2`,
      [members, row.group_id],
    );
    return r.rows;
  }

  /** One POST to the push service; returns its HTTP status, or 0 on a network error. */
  async function deliver(s: Target, body: string, urgency: "high" | "normal"): Promise<number> {
    try {
      const req = webpush.generateRequestDetails(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: deps.ttl ?? TTL_S, urgency, vapidDetails, contentEncoding: "aes128gcm" },
      );
      const res = await http(req.endpoint, {
        method: "POST",
        headers: req.headers as Record<string, string>,
        body: req.body ? new Uint8Array(req.body) : null,
        signal: AbortSignal.timeout(10_000),
      });
      await res.body?.cancel();
      return res.status;
    } catch {
      return 0;
    }
  }

  return {
    /** Sends one engine push effect for a gathering, after commit (BE runs effects). */
    async notify(gatheringId: string, effect: PushEffect): Promise<PushResult> {
      const g = await deps.db.query<PushRow>(
        "select id, kind, group_id, chosen_set, notice_ct, start_at from gatherings where id = $1",
        [gatheringId],
      );
      const row = g.rows[0];
      const out: PushResult = { sent: 0, removed: 0, failed: 0 };
      if (!row) return out;
      const body = JSON.stringify(noticePayload(row, effect));
      const urgency = effect.event === "lit" || effect.event === "plan_on" ? "high" : "normal";
      await Promise.all(
        (await targets(row, effect.to)).map(async (s) => {
          const code = await deliver(s, body, urgency);
          if (code >= 200 && code < 300) out.sent++;
          else if (code === 404 || code === 410) {
            await deps.db.query("delete from push_subscriptions where member_id = $1 and endpoint = $2", [
              s.member_id,
              s.endpoint,
            ]);
            out.removed++;
          } else out.failed++;
        }),
      );
      log.info({ event: "push.sent", push: effect.event, ...out }, "push");
      return out;
    },
  };
}
export type Push = ReturnType<typeof createPush>;

/** VAPID settings from env, or null when push is not configured (Config.vapid_public_key null). */
export function vapidFromEnv(env: NodeJS.ProcessEnv = process.env): Vapid | null {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
