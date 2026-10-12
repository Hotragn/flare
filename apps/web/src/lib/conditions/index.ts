// ICD-7 implementation: text to structured rules plus a read-back, all on the phone.
// Free text never leaves this module (BR-C-9, SRS-COND-6): callers get Rule[] and copy strings.
import type { ConditionsIcd, Engine } from "@flare/shared/icd/index";
import { t } from "../ai/copy.ts";
import { parseRaw, type RawRule } from "./rules.ts";
import { localToIso, timeLabel } from "./time.ts";

type Rule = Engine.Rule;
type ParseContext = ConditionsIcd.ParseContext;
type ParseResult = ConditionsIcd.ParseResult;

export const READBACK_MAX_WORDS = 12; // SRS-COND-5

// Steps lead, as in SRS-PLAN-10's example: "step 3 or smaller, back by 5 PM".
const ORDER: Rule["type"][] = ["max_step", "min_step", "with", "after", "back_by", "max_walk"];

export const countWords = (s: string): number => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const MIN = 60_000;
// Rules made from a delay ("in 10 min"), so the read-back says it the way it was said.
const delayMin = new WeakMap<Rule, number>();

/**
 * A bare hour ("after 10") means the next one coming up from now: 8:22 PM plus "after 10" is
 * 10 PM, 9 AM plus "after 10" is 10 AM. Never a time already gone (live bug, Oct 11).
 */
function upcoming(hhmm: string, ctx: ParseContext, kind: "after" | "back_by" = "back_by"): string {
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  const h12 = h % 12;
  const mm = String(mi).padStart(2, "0");
  const now = Date.parse(ctx.now);
  const tomorrow = new Date(now + 24 * 60 * MIN).toISOString();
  const tries = [
    localToIso(`${String(h).padStart(2, "0")}:${mm}`, ctx.now, ctx.tz), // the usual reading first
    localToIso(`${String(h12 + (h >= 12 ? 0 : 12)).padStart(2, "0")}:${mm}`, ctx.now, ctx.tz),
    localToIso(`${String(h12).padStart(2, "0")}:${mm}`, tomorrow, ctx.tz),
  ];
  // Round 6: "after 10" said at 10:40 PM means 10 PM, which already holds, not 10 AM tomorrow.
  if (kind === "after") {
    const held = tries
      .slice(0, 2)
      .filter((iso) => Date.parse(iso) <= now && now - Date.parse(iso) < 6 * 60 * MIN)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    if (held) return held;
  }
  return tries.find((iso) => Date.parse(iso) >= now - MIN) ?? (tries[2] as string);
}

function toRule(r: RawRule, ctx: ParseContext): Rule | null {
  switch (r.type) {
    case "after_in": {
      const rule: Rule = { type: "after", at: new Date(Date.parse(ctx.now) + r.value * MIN).toISOString() };
      delayMin.set(rule, r.value);
      return rule;
    }
    case "with": {
      const m = ctx.members.find((x) => x.name.toLowerCase() === r.value.toLowerCase());
      return m ? { type: "with", member_id: m.id } : null;
    }
    case "after":
    case "back_by":
      return { type: r.type, at: r.bare ? upcoming(r.value, ctx, r.type) : localToIso(r.value, ctx.now, ctx.tz) };
    case "max_walk":
      return { type: "max_walk", minutes: r.value };
    case "max_step":
    case "min_step":
      return ctx.kind === "plan" ? { type: r.type, step: r.value } : null; // steps are Plans only (BR-C-1)
  }
}

const memberName = (id: string, ctx: ParseContext) => ctx.members.find((m) => m.id === id)?.name ?? "";

/** One fragment per rule kind, in a fixed order; several with() rules share one fragment. */
function fragments(rules: Rule[], ctx: ParseContext, style: "rule" | "chip"): string[] {
  const sorted = [...rules].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const out: string[] = [];
  const names = sorted.filter((r) => r.type === "with").map((r) => memberName(r.member_id, ctx));
  let namesDone = false;
  for (const r of sorted) {
    if (r.type === "with") {
      if (namesDone) continue;
      namesDone = true;
      const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
      out.push(t(`readback.${style}.with`, { name: joined ?? "" }));
    } else if (r.type === "after" && style === "rule" && delayMin.has(r))
      out.push(t("readback.rule.afterIn", { min: delayMin.get(r) ?? 0 }));
    else if (r.type === "after") out.push(t(`readback.${style}.after`, { time: timeLabel(r.at, ctx.tz) }));
    else if (r.type === "back_by") out.push(t(`readback.${style}.backBy`, { time: timeLabel(r.at, ctx.tz) }));
    else if (r.type === "max_walk") out.push(t(`readback.${style}.maxWalk`, { min: r.minutes }));
    else if (r.type === "max_step") out.push(t(`readback.${style}.maxStep`, { k: r.step }));
    else if (r.type === "min_step") out.push(t(`readback.${style}.minStep`, { k: r.step }));
  }
  return out;
}

/** The read-back line, ≤ 12 words (SRS-COND-5). Past 12 words it counts the rules; the chips list them. */
export function readBack(rules: Rule[], ctx: ParseContext): string {
  if (!rules.length) return t("readback.plain.title");
  const full = t("readback.line", { rules: fragments(rules, ctx, "rule").join(", ") });
  if (countWords(full) <= READBACK_MAX_WORDS) return full;
  return t("readback.many", { n: rules.length });
}

/** One chip label per rule group, for the I3 sheet ("Rules that will be sent"). */
export const readBackChips = (rules: Rule[], ctx: ParseContext): string[] => fragments(rules, ctx, "chip");

// Words that carry no rule on their own, so a clause made only of them isn't "missed".
const FILLER = new Set(
  "i im i'm can could come make it works work fine ok okay yes yeah yep sure but so and then me count in sounds good totally lol haha maybe probably will be there down great cool love to the a an that this we us go going lets let's do i'll ill would should too also".split(
    " ",
  ),
);

/** Clauses the parser read nothing from, so the read-back never drops words quietly. */
function missedWords(text: string, ctx: ParseContext): string {
  const names = ctx.members.map((m) => m.name);
  const out: string[] = [];
  for (const clause of text.split(/[,;.!?]+|\s+but\s+/i)) {
    const c = clause.trim();
    const words = c.toLowerCase().match(/[\p{L}'0-9]+/gu) ?? [];
    if (!words.some((w) => !FILLER.has(w))) continue;
    const r = parseRaw(c, names, ctx.steps ?? [], ctx.host ?? "");
    if (r.ok && r.rules.some((x) => toRule(x, ctx))) continue;
    if (!r.ok && r.reason !== "didnt_catch") continue;
    out.push(c);
  }
  const all = out.join(", ").split(/\s+/);
  return all.length > 8 ? `${all.slice(0, 8).join(" ")}...` : all.join(" ");
}

export function parse(text: string, ctx: ParseContext): ParseResult {
  const raw = parseRaw(
    text,
    ctx.members.map((m) => m.name),
    ctx.steps ?? [],
    ctx.host ?? "",
  );
  if (!raw.ok) return raw.reason === "not_in_group" ? { ok: false, reason: raw.reason, name: raw.name } : raw;
  const rules: Rule[] = [];
  for (const r of raw.rules) {
    const rule = toRule(r, ctx);
    if (rule) rules.push(rule);
  }
  // Only step words on a Flare: nothing usable was said.
  if (raw.rules.length && !rules.length) return { ok: false, reason: "didnt_catch" };
  const missed = rules.length ? missedWords(text, ctx) : "";
  return { ok: true, rules, readBack: readBack(rules, ctx), ...(missed ? { missed } : {}) };
}

/**
 * Tap-to-fill rules for when typing didn't work (live bug, Oct 11): built from the time of day
 * and the host's name, never the reader's. Each `text` parses back to exactly its rule.
 */
export function suggestions(ctx: ParseContext): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [{ label: t("cond.chip.in", { min: 10 }), text: "in 10 min" }];
  const host = ctx.host && ctx.members.some((m) => m.name.toLowerCase() === ctx.host?.toLowerCase()) ? ctx.host : "";
  if (host) out.push({ label: t("cond.chip.with", { name: host }), text: `only with ${host}` });
  const now = Date.parse(ctx.now);
  const at = new Date(Math.ceil((now + 30 * MIN) / (60 * MIN)) * 60 * MIN).toISOString(); // the next full hour, 30+ min away
  const label = timeLabel(at, ctx.tz);
  const [h, ap] = label.split(" ");
  out.push({ label: t("cond.chip.after", { time: label }), text: `after ${h}${(ap ?? "").toLowerCase()}` });
  out.push({ label: t("cond.chip.walk", { min: 15 }), text: "15 min walk max" });
  return out;
}

/** User-facing message for a failed parse (SRS-COND-7, SRS-COND-8, BR-C-2). */
export function parseError(r: Extract<ParseResult, { ok: false }>): string {
  if (r.reason === "not_in_group") return t("cond.notInGroup", { name: r.name ?? "" });
  if (r.reason === "too_many") return t("cond.tooMany");
  return t("cond.didntCatch");
}

export const conditions: ConditionsIcd.Conditions = { parse, readBack, suggestions };
