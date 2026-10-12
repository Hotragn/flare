// Remember this (ADR-0031): a conversation note made only with everyone's consent.
// The rule, in one pure function so it can be property-tested: recording is possible only when
// the host turned it on for this Flare or Plan, it is lit, and every person who said yes agreed
// on their own phone. Any no, or anyone who joined later without agreeing, makes it off for
// everyone. The result never says who: only on / ready / recording flags.
import type { Q } from "../db/db.ts";

export const RECORD_MAX_MS = 60_000;

export type RememberInput = {
  on: boolean; // the host turned it on (the host's own consent)
  lit: boolean;
  yes: readonly string[]; // members whose answer is yes (the host is not in this list)
  consent: ReadonlyMap<string, boolean>; // member id -> agreed (absent = not answered)
  recordingUntil: number | null;
  now: number;
};
export type RememberPublic = { on: boolean; ready: boolean; recording: boolean; recording_until: string | null };

export function rememberState(i: RememberInput): RememberPublic {
  const everyoneAgreed = i.yes.length > 0 && i.yes.every((id) => i.consent.get(id) === true);
  const ready = i.on && i.lit && everyoneAgreed;
  const recording = ready && i.recordingUntil !== null && i.recordingUntil > i.now;
  return {
    on: i.on,
    ready,
    recording,
    recording_until: recording ? new Date(i.recordingUntil as number).toISOString() : null,
  };
}

export type RememberRow = { on_by_host: boolean; recording_until: Date | null; note_ct: Buffer | null };

export async function loadRemember(
  q: Q,
  gatheringId: string,
): Promise<{ row: RememberRow; consent: Map<string, boolean> }> {
  const r = await q.query<RememberRow>(
    "select on_by_host, recording_until, note_ct from remember where gathering_id = $1",
    [gatheringId],
  );
  const c = await q.query<{ member_id: string; ok: boolean }>(
    "select member_id, ok from remember_consent where gathering_id = $1",
    [gatheringId],
  );
  return {
    row: r.rows[0] ?? { on_by_host: false, recording_until: null, note_ct: null },
    consent: new Map(c.rows.map((x) => [x.member_id, x.ok])),
  };
}
