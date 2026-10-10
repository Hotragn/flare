// Plaintext shapes that only phones see, before sealing and after opening (ICD-5,
// openapi.yaml SealedGathering and NoticeText). Phones validate after open() so a damaged
// or foreign blob fails cleanly instead of rendering garbage.
import { z } from "zod";

const Place = z.object({
  name: z.string().max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  key: z.string().max(140), // place key: OSM element id, else the name (BR-K-4)
});
const Amenity = z.object({ count: z.number().int().min(0), nearest_m: z.number().int().min(0).nullable() });

export const SealedGathering = z.object({
  v: z.literal(1),
  host_name: z.string().min(1).max(40),
  invite: z.string().min(1).max(80),
  scene: z.string().max(200),
  host_line: z.string().max(120),
  spot: Place,
  candidates: z.record(z.string().regex(/^c([1-9]|1[0-2])$/), Place).optional(),
  steps: z.record(z.string().regex(/^step:[1-4]$/), z.object({ name: z.string().max(40), place: Place })).optional(),
  nature_line: z.string().max(120).optional(),
  access: z.object({ benches: Amenity, restrooms: Amenity, water: Amenity, steps_mapped: z.boolean() }).optional(),
});

export const NoticeText = z.object({
  v: z.literal(1),
  host: z.string().min(1).max(40),
  spot: z.string().max(120),
  benches: z.record(z.string(), z.string().max(120)).optional(),
  steps: z.record(z.string(), z.string().max(40)).optional(),
});

export type SealedGatheringT = z.infer<typeof SealedGathering>;
export type NoticeTextT = z.infer<typeof NoticeText>;
