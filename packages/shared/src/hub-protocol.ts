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

export const JobResult = z.object({
  type: z.literal("result"),
  id: z.string().uuid(),
  ok: z.boolean(),
  draft: z.object({ invite: z.string().min(1), alt: z.string().min(1) }).optional(),
  error: z.enum(["model_unavailable", "unusable_answer", "timeout", "bad_image"]).optional(),
  ms: z.number().int().nonnegative(),
  model: z.string(),
});

export const Ping = z.object({ type: z.literal("ping"), t: z.number() });
export const Pong = z.object({ type: z.literal("pong"), t: z.number() });

export const FromHub = z.discriminatedUnion("type", [HelloFromHub, JobResult, Pong]);
export const ToHub = z.discriminatedUnion("type", [JobHeader, Ping]);

export type JobHeaderT = z.infer<typeof JobHeader>;
export type JobResultT = z.infer<typeof JobResult>;
export type FromHubT = z.infer<typeof FromHub>;
export type ToHubT = z.infer<typeof ToHub>;
