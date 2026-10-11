// Seeds a hosted Flare or Plan on the fake server the way the host's phone would.
import type { SealedGatheringT } from "@flare/shared/sealed";
import type { fakeDeps } from "./index.ts";

type F = ReturnType<typeof fakeDeps>;

export const SPOT = { name: "Ford Woods Park, by the pond", lat: 42.3196, lon: -83.2129, key: "way/1" };

export async function seedFlare(f: F, opts: { kind?: "flare" | "plan"; quorum?: number; photo?: boolean } = {}) {
  const { key, fragment } = await f.crypto.newGroupKey();
  const groupId = crypto.randomUUID();
  const hostId = crypto.randomUUID();
  const token = "hHhHhHhHhHhHhHhHhHhHhH";
  await f.server.handle(
    "POST",
    "/api/v1/groups",
    { id: groupId, member: { id: hostId, name_ct: "x", write_token: token } },
    null,
  );
  const who = { group: groupId, member: hostId };
  const id = crypto.randomUUID();
  const sealed: SealedGatheringT = {
    v: 1,
    host_name: "Fuego",
    invite: opts.kind === "plan" ? "Fairlane walk at 11?" : "Golden pond, come sit with me",
    scene: "A pond with yellow trees and an empty bench.",
    host_line: "Fuego is waiting at the bench by the pond.",
    spot: SPOT,
    candidates: { c1: { name: "the bench by the lot", lat: 42.3201, lon: -83.2131, key: "node/2" } },
    steps:
      opts.kind === "plan"
        ? {
            "step:1": { name: "Ford Woods loop", place: SPOT },
            "step:2": { name: "Park loop", place: SPOT },
            "step:3": { name: "Short walk", place: SPOT },
            "step:4": { name: "10 min on the bench", place: SPOT },
          }
        : undefined,
    nature_line: "Sunset 6:57 PM",
    access: {
      benches: { count: 3, nearest_m: 40 },
      restrooms: { count: 1, nearest_m: 180 },
      water: { count: 0, nearest_m: null },
      steps_mapped: false,
    },
  };
  const now = f.deps.now();
  const plan =
    opts.kind === "plan"
      ? {
          start_at: new Date(now + 3_600_000).toISOString(),
          deadline_at: new Date(now + 2_400_000).toISOString(),
          steps: [
            { step: 1 as const, minutes: 60, place: "step:1" as const },
            { step: 2 as const, minutes: 30, place: "step:2" as const },
            { step: 3 as const, minutes: 15, place: "step:3" as const },
            { step: 4 as const, minutes: 10, place: "step:4" as const },
          ],
        }
      : undefined;
  await f.server.handle(
    "POST",
    `/api/v1/groups/${groupId}/gatherings`,
    {
      id,
      kind: opts.kind ?? "flare",
      quorum: opts.quorum ?? 2,
      tz: "America/Detroit",
      sealed: await f.crypto.sealJson(key, `g:${id}`, sealed),
      notice_ct: await f.crypto.sealJson(key, `n:${id}`, { v: 1, host: "Fuego", spot: SPOT.name }),
      plan,
    },
    who,
  );
  if (opts.photo) {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const ct = await f.crypto.seal(key, `p:${id}`, jpeg);
    await f.server.handle("PUT", `/api/v1/gatherings/${id}/photo`, new Uint8Array(Buffer.from(ct, "base64url")), who);
  }
  return { id, groupId, hostId, fragment, key, sealed };
}
