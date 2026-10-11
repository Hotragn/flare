// Hub relay protocol (docs/architecture/contracts/asyncapi.yaml, channel /hub).
// The Mac hub opens an outbound WebSocket to the server; the server sends jobs.
// Text frames carry JSON control messages; a photo job is one text frame (job header)
// followed by one binary frame (the 768 px JPEG). Nothing on the Mac is exposed (ADR-0006).
import { z } from "zod";

export const HUB_PROTOCOL = "flare-hub.v1";

export const HelloFromHub = z.object({
  type: z.literal("hello"),
  protocol: z.literal(HUB_PROTOCOL),
  model: z.string().min(1),
  ready: z.boolean(),
});

export const JobHeader = z.object({
  type: z.literal("job"),
  id: z.string().uuid(),
  kind: z.literal("photo-draft"),
  bytes: z.number().int().positive().max(2_000_000),
  mime: z.literal("image/jpeg"),
});

/** ICR-BE-1: Plan ladder job (asyncapi `ladderJob`). Text only, 8 s budget. */
export const LadderJob = z.object({
  type: z.literal("job"),
  id: z.string().uuid(),
  kind: z.literal("ladder-draft"),
  ask: z.string().max(80),
  total_minutes: z.number().int().min(40).max(600),
  weather: z.object({ rain_likely: z.boolean(), temp_f: z.number().int() }).optional(),
});

/** ICR-ML5: Fix the map photo to OSM tags (asyncapi `tagsJob`). Header frame, then one JPEG
 * frame, like a photo job; 8 s budget. The tags are a draft a person reviews one by one. */
export const TagsJob = JobHeader.extend({ kind: z.literal("tags-draft") });

export const HubLadderStep = z.object({
  step: z.number().int().min(1).max(4),
  label: z.string(),
  minutes: z.number().int(),
});

export const JobResult = z.object({
  type: z.literal("result"),
  id: z.string().uuid(),
  ok: z.boolean(),
  draft: z.object({ invite: z.string().min(1), alt: z.string().min(1) }).optional(),
  ladder: z.array(HubLadderStep).length(4).optional(), // ICR-BE-1
  tags: z.record(z.string(), z.string()).optional(), // ICR-ML5, after enforceOsmTags
  error: z.enum(["model_unavailable", "unusable_answer", "timeout", "bad_image"]).optional(),
  ms: z.number().int().nonnegative(),
  model: z.string(),
});

export const Ping = z.object({ type: z.literal("ping"), t: z.number() });
export const Pong = z.object({ type: z.literal("pong"), t: z.number() });

export const FromHub = z.discriminatedUnion("type", [HelloFromHub, JobResult, Pong]);
export const ToHub = z.discriminatedUnion("type", [JobHeader, Ping]);
/** ICR-BE-1: everything the server may send once the hub handles ladder jobs. A hub on
 * plain ToHub ignores ladder jobs, and the server falls back to the template after 8 s. */
export const ToHubV11 = z.union([JobHeader, LadderJob, TagsJob, Ping]);

export type JobHeaderT = z.infer<typeof JobHeader>;
export type JobResultT = z.infer<typeof JobResult>;
export type FromHubT = z.infer<typeof FromHub>;
export type ToHubT = z.infer<typeof ToHub>;
export type LadderJobT = z.infer<typeof LadderJob>;
export type TagsJobT = z.infer<typeof TagsJob>;
export type ToHubV11T = z.infer<typeof ToHubV11>;
