// Strict zod schemas for request bodies, one per openapi.yaml schema. Unknown keys fail
// (additionalProperties: false in the contract).
import { z } from "zod";

export const Id = z.uuid();
export const Token = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const ShortCode = z.string().regex(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
export const Label = z.string().regex(/^(spot|c([1-9]|1[0-2])|step:[1-4])$/);
export const PlaceHash = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const ct = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+$/);
export const NameCt = ct(200);
export const SmallCt = ct(1400);
export const SealedCt = ct(22000);
export const NoticeCt = ct(2800);
export const BlobCt = ct(90000);
export const SparkCt = ct(800);
const DateTime = z.iso.datetime({ offset: true });

export const NewMember = z.strictObject({ id: Id, name_ct: NameCt, write_token: Token });
export const CreateGroup = z.strictObject({ id: Id, member: NewMember });
export const Rename = z.strictObject({ name_ct: NameCt });
export const Forget = z.strictObject({ spark_delete_tokens: z.array(Token).max(500).optional() });

const Step = z.number().int().min(1).max(4);
export const PlanStep = z.strictObject({ step: Step, minutes: z.number().int().min(5).max(600), place: Label });

export const CreateGathering = z.strictObject({
  id: Id,
  kind: z.enum(["flare", "plan"]),
  quorum: z.number().int().min(2).max(6),
  tz: z.string().min(1).max(64),
  sealed: SealedCt,
  notice_ct: NoticeCt,
  ember_candidates: z.array(Label).max(12).optional(),
  plan: z.strictObject({ start_at: DateTime, deadline_at: DateTime, steps: z.array(PlanStep).length(4) }).optional(),
  telegram: z
    .strictObject({
      host: z.string().max(40),
      invite: z.string().max(80),
      place: z.string().max(120),
      link: z.url().max(300),
      ember_places: z.record(Label, z.string().max(120)).optional(),
      step_names: z.record(Label, z.string().max(40)).optional(),
    })
    .optional(),
});

export const Rule = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("with"), member_id: Id }),
  z.strictObject({ type: z.literal("after"), at: DateTime }),
  z.strictObject({ type: z.literal("back_by"), at: DateTime }),
  z.strictObject({ type: z.literal("max_walk"), minutes: z.number().int().min(1).max(120) }),
  z.strictObject({ type: z.literal("max_step"), step: Step }),
  z.strictObject({ type: z.literal("min_step"), step: Step }),
]);

export const Checks = z.strictObject({
  results: z.record(Label, z.boolean()).refine((r) => Object.keys(r).length <= 17, { message: "at most 17 labels" }),
});

export const AnswerBody = z.strictObject({
  answer: z.enum(["yes", "cant_make_it"]),
  rules: z.array(Rule).max(4).default([]),
  ember_only: z.boolean().default(false),
  checks: Checks.optional(),
});

export const TextYes = z.strictObject({ code: ShortCode });

export const ArrivalBody = z
  .strictObject({
    for: z.enum(["self", "member", "someone_else"]),
    member_id: Id.optional(),
    recorded_at: DateTime,
  })
  .refine((a) => a.for !== "member" || !!a.member_id, { message: "member_id needed" });

export const LiveLocation = z.strictObject({ location_ct: SmallCt });

export const NewSpark = z.strictObject({
  id: Id,
  ticket: Token,
  place: PlaceHash,
  text_ct: SparkCt,
  delete_token: Token,
});

export const HotspotsBody = z.strictObject({ blob_ct: BlobCt });

export const PushSubscription = z.strictObject({
  endpoint: z.url().max(1000),
  keys: z.strictObject({ p256dh: z.string().max(200), auth: z.string().max(50) }),
});

export const LadderRequest = z.strictObject({
  ask: z.string().min(1).max(80),
  total_minutes: z.number().int().min(40).max(600),
  weather: z.strictObject({ rain_likely: z.boolean(), temp_f: z.number().int().min(-40).max(130) }).optional(),
});
