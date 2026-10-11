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

function toRule(r: RawRule, ctx: ParseContext): Rule | null {
  switch (r.type) {
    case "with": {
      const m = ctx.members.find((x) => x.name.toLowerCase() === r.value.toLowerCase());
      return m ? { type: "with", member_id: m.id } : null;
    }
    case "after":
    case "back_by":
      return { type: r.type, at: localToIso(r.value, ctx.now, ctx.tz) };
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
    } else if (r.type === "after") out.push(t(`readback.${style}.after`, { time: timeLabel(r.at, ctx.tz) }));
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

export function parse(text: string, ctx: ParseContext): ParseResult {
  const raw = parseRaw(
    text,
    ctx.members.map((m) => m.name),
    ctx.steps ?? [],
  );
  if (!raw.ok) return raw.reason === "not_in_group" ? { ok: false, reason: raw.reason, name: raw.name } : raw;
  const rules: Rule[] = [];
  for (const r of raw.rules) {
    const rule = toRule(r, ctx);
    if (rule) rules.push(rule);
  }
  // Only step words on a Flare: nothing usable was said.
  if (raw.rules.length && !rules.length) return { ok: false, reason: "didnt_catch" };
  return { ok: true, rules, readBack: readBack(rules, ctx) };
}

/** User-facing message for a failed parse (SRS-COND-7, SRS-COND-8, BR-C-2). */
export function parseError(r: Extract<ParseResult, { ok: false }>): string {
  if (r.reason === "not_in_group") return t("cond.notInGroup", { name: r.name ?? "" });
  if (r.reason === "too_many") return t("cond.tooMany");
  return t("cond.didntCatch");
}

export const conditions: ConditionsIcd.Conditions = { parse, readBack };
