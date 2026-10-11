// HTTP payloads shared by web and server (docs/architecture/contracts/openapi.yaml).
import { z } from "zod";

export const DraftResponse = z.object({
  invite: z.string().min(1),
  alt: z.string(),
  tier: z.enum(["hub", "rules", "cloud"]), // cloud: DigitalOcean (ADR-0022)
  ms: z.number().int().nonnegative(),
});
export type DraftResponseT = z.infer<typeof DraftResponse>;

export const Health = z.object({
  ok: z.boolean(),
  version: z.string(),
  hub: z.enum(["connected", "absent"]),
  db: z.enum(["ok", "down", "not_configured"]),
});
export type HealthT = z.infer<typeof Health>;

export const MAX_PHOTO_BYTES = 1_500_000;
