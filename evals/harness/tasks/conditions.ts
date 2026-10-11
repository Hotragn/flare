// Conditions parsing on the phone tier (rules, no model): SRS-COND-3/-4, CR-A1 (ADR-0016).
// Runs any ICD-7 parser (`--parser <module>`). Without one it runs the lab 07 reference
// parser in place as a baseline, so the report shows what OD1 must add (min_step).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { countWords } from "../../../packages/shared/src/prompts/guard.ts";
import { dataset, labDir, REPO_DIR, readJson } from "../paths.ts";
import type { Report } from "../report.ts";

type Expect = { type: string; value: string | number }[] | string | null;
type Case = { text: string; expect: Expect };
type Fixture = { group_members: string[]; time_zone: string; core_40: Case[]; hard_20: Case[] };
type CrA1 = { steps: { step: number; name: string }[]; min_step_4: Case[] };

/** Answer in the fixture's form: [{type, value}] | [] | null (unparsed) | "error:not_in_group". */
type Simple = { type: string; value: string | number }[] | string | null;
type Parser = { name: string; parse: (text: string) => Simple; readBack?: (text: string) => string | null };

const TZ = "America/Detroit";
const NOW = "2026-10-11T15:00:00.000Z"; // 11:00 in Dearborn, field-test day

export function same(got: Simple, expect: Expect): boolean {
  if (expect === null || typeof expect === "string") return got === expect;
  if (!Array.isArray(got)) return false;
  const k = (a: { type: string; value: string | number }[]) =>
    a
      .map((r) => `${r.type}=${r.value}`)
      .sort()
      .join("|");
  return k(got) === k(expect);
}

const localHm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );

type IcdRule = { type: string; member_id?: string; at?: string; minutes?: number; step?: number };
type IcdResult = { ok: true; rules: IcdRule[]; readBack: string } | { ok: false; reason: string };
type IcdModule = {
  parse?: (t: string, c: unknown) => IcdResult;
  conditions?: { parse: (t: string, c: unknown) => IcdResult };
  default?: { parse: (t: string, c: unknown) => IcdResult };
};

async function icdParser(path: string, members: string[], steps: CrA1["steps"]): Promise<Parser> {
  const mod = (await import(pathToFileURL(path).href)) as IcdModule;
  const parse = mod.parse ?? mod.conditions?.parse ?? mod.default?.parse;
  if (!parse) throw new Error(`${path} exports no ICD-7 parse()`);
  const ctx = {
    members: members.map((name) => ({ id: `m-${name.toLowerCase()}`, name })),
    tz: TZ,
    now: NOW,
    kind: "plan",
    steps,
  };
  const byId = new Map(ctx.members.map((m) => [m.id, m.name]));
  const run = (t: string) => parse(t, ctx);
  return {
    name: path.replace(REPO_DIR, "."),
    parse(text) {
      const r = run(text);
      if (!r.ok) return r.reason === "not_in_group" ? "error:not_in_group" : null;
      return r.rules.map((x) => {
        if (x.type === "with") return { type: "with", value: byId.get(x.member_id ?? "") ?? "?" };
        if (x.type === "after" || x.type === "back_by") return { type: x.type, value: localHm(x.at ?? "") };
        if (x.type === "max_walk") return { type: x.type, value: x.minutes ?? -1 };
        return { type: x.type, value: x.step ?? -1 };
      });
    },
    readBack(text) {
      const r = run(text);
      return r.ok ? r.readBack : null;
    },
  };
}

async function labParser(members: string[]): Promise<Parser> {
  const lab = labDir();
  const p = lab && join(lab, "spikes", "07-phone-text-model", "rules.mjs");
  if (!p || !existsSync(p)) throw new Error("no --parser given and lab 07 rules.mjs not found");
  const mod = (await import(pathToFileURL(p).href)) as { parseRules: (t: string, m: string[]) => Simple };
  return { name: "lab 07 reference parser (baseline)", parse: (t) => mod.parseRules(t, members) };
}

export async function runConditions(tier: string, parserPath?: string): Promise<Report> {
  const fx = readJson<Fixture>(join(REPO_DIR, "docs", "requirements", "fixtures", "conditions-60.json"));
  const cr = dataset<CrA1>("conditions-cr-a1.json");
  const defaultPath = join(REPO_DIR, "apps", "web", "src", "lib", "conditions", "index.ts");
  const path = parserPath ? join(REPO_DIR, parserPath) : existsSync(defaultPath) ? defaultPath : null;
  const parser = path ? await icdParser(path, fx.group_members, cr.steps) : await labParser(fx.group_members);
  const rows: Record<string, unknown>[] = [];
  const score = (set: string, cases: Case[]) => {
    let ok = 0;
    for (const c of cases) {
      let got: Simple;
      let error: string | null = null;
      try {
        got = parser.parse(c.text);
      } catch (e) {
        got = null;
        error = (e as Error).message;
      }
      const pass = same(got, c.expect);
      if (pass) ok++;
      const rb = parser.readBack?.(c.text) ?? null;
      rows.push({ set, text: c.text, expect: c.expect, got, pass, error, readback_words: rb ? countWords(rb) : null });
    }
    return ok;
  };
  const core = score("core_40", fx.core_40);
  const hard = score("hard_20", fx.hard_20);
  const minStep = score("cr_a1_min_step", cr.min_step_4);
  const rbOver = rows.filter((r) => typeof r.readback_words === "number" && (r.readback_words as number) > 12).length;
  const bars = [
    { name: "core_40", target: "≥ 36/40", value: `${core}/40`, pass: core >= 36 },
    { name: "hard_20 (reported)", target: "report; lab 15/20", value: `${hard}/20`, pass: true },
    { name: "CR-A1 min_step phrases", target: "4/4", value: `${minStep}/4`, pass: minStep === 4 },
  ];
  if (parser.readBack)
    bars.push({ name: "Read-backs over 12 words", target: "0", value: String(rbOver), pass: rbOver === 0 });
  return {
    task: "conditions",
    tier,
    model: `none (rules): ${parser.name}`,
    prompt: "n/a (no model; ADR-0007)",
    date: new Date().toISOString(),
    n: rows.length,
    bars,
    notes: [
      "Fixture: docs/requirements/fixtures/conditions-60.json plus evals/datasets/conditions-cr-a1.json.",
      "Context: members Fuego, Amor, Shilp, Ammo; tz America/Detroit; now 2026-10-11 11:00 local; kind plan with 4 named steps.",
    ],
    items: rows,
  };
}
