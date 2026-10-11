// Photo to invite + scene (FR-AI-1, SRS-AI-2, SRS-AI-3). Bars are in docs/ml/quality-bars.md,
// written before the first measured run.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countWords, enforce, PHOTO_PROMPT, TEMPLATE_INVITE } from "../../../packages/shared/src/photo.ts";
import { hasPersonWords } from "../../../packages/shared/src/prompts/guard.ts";
import { chat, MODEL } from "../ollama.ts";
import { dataset, labDir, readJson } from "../paths.ts";
import { latency, type Report } from "../report.ts";

type Item = { id: string; expect_any: string[]; names_ok: string[]; people: boolean };
type Manifest = { id: string; file: string; license: string; author: string; use: boolean }[];

/** Capitalised words that are not sentence starts and not on the item's sign list. */
export function suspectNames(text: string, ok: string[]): string[] {
  const allow = new Set(ok.map((w) => w.toLowerCase()));
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const words = (sentence.match(/[\p{L}']+/gu) ?? []).map((w) => w.replace(/^'+|'+$/g, ""));
    words.forEach((w, i) => {
      if (i > 0 && /^\p{Lu}/u.test(w) && !allow.has(w.toLowerCase().replace(/'s$/, ""))) out.push(w);
    });
  }
  return out;
}

export const hits = (text: string, any: string[]) => any.some((k) => new RegExp(`\\b${k}\\b`, "i").test(text));

export async function runPhoto(tier: string, limit?: number): Promise<Report> {
  const items = dataset<{ items: Item[] }>("photos.json").items.slice(0, limit);
  const date = new Date().toISOString();
  const base = { task: "photo", tier, date, n: items.length, prompt: `${PHOTO_PROMPT.id}@${PHOTO_PROMPT.version}` };
  if (tier === "rules") {
    const d = { invite: TEMPLATE_INVITE, alt: "" };
    return {
      ...base,
      model: "none (template)",
      bars: [
        { name: "Usable", target: "100%", value: `${items.length}/${items.length}`, pass: true },
        {
          name: "Person words",
          target: "0",
          value: String(hasPersonWords(d.invite) ? items.length : 0),
          pass: !hasPersonWords(d.invite),
        },
        {
          name: "Invite ≤ 6 words",
          target: "yes",
          value: String(countWords(d.invite)),
          pass: countWords(d.invite) <= 6,
        },
      ],
      notes: [
        "The template tier writes the same invite for every photo; the scene comes from map-pack facts (FE, OD4).",
      ],
      items: [],
    };
  }
  const lab = labDir();
  if (!lab) throw new Error("lab/data/photos not found; set FLARE_LAB_DIR");
  const manifest = readJson<Manifest>(join(lab, "data", "photos", "photos.json"));
  const rows: Record<string, unknown>[] = [];
  const ms: number[] = [];
  let usable = 0;
  let firstTry = 0;
  let person = 0;
  let personRaw = 0;
  let names = 0;
  let accurate = 0;
  let overBudget = 0;
  for (const it of items) {
    const m = manifest.find((x) => x.id === it.id);
    if (!m?.use) throw new Error(`photo ${it.id} missing or not cleared in the lab manifest`);
    const b64 = readFileSync(join(lab, "data", "photos", m.file)).toString("base64");
    let total = 0;
    let draft = null;
    let raw = "";
    let attempts = 0;
    // Same policy as the hub: retry once inside the budget (architecture 07 B3).
    while (attempts < 2 && !draft) {
      attempts++;
      const r = await chat({ system: PHOTO_PROMPT.system, user: PHOTO_PROMPT.user, imageBase64: b64 });
      total += r.ms;
      raw = r.text;
      if (hasPersonWords(raw)) personRaw++;
      draft = enforce(raw);
      if (total > PHOTO_PROMPT.budgetMs) break;
    }
    ms.push(total);
    if (total > PHOTO_PROMPT.budgetMs) overBudget++;
    if (draft && attempts === 1) firstTry++;
    if (draft && total <= PHOTO_PROMPT.budgetMs) usable++;
    const shown = draft ? `${draft.invite}. ${draft.alt}` : "";
    if (draft && hasPersonWords(shown)) person++;
    const sus = draft ? suspectNames(shown, it.names_ok) : [];
    if (sus.length) names++;
    const acc = draft ? hits(draft.alt, it.expect_any) : false;
    if (acc) accurate++;
    rows.push({
      id: it.id,
      license: m.license,
      people_in_frame: it.people,
      ms: total,
      attempts,
      invite: draft?.invite ?? null,
      alt: draft?.alt ?? null,
      repaired: draft?.repaired ?? [],
      key_fact_hit: acc,
      suspect_names: sus,
    });
  }
  const n = items.length;
  const lat = latency(ms);
  return {
    ...base,
    model: MODEL,
    latency: lat,
    bars: [
      { name: "Usable within 6 s budget", target: `≥ 19/${n}`, value: `${usable}/${n}`, pass: usable >= n - 1 },
      { name: "Shown text with person words", target: "0", value: String(person), pass: person === 0 },
      { name: "Invented names (unreviewed suspects)", target: "0", value: String(names), pass: names === 0 },
      { name: "Scene names a key fact", target: `≥ 18/${n}`, value: `${accurate}/${n}`, pass: accurate >= n - 2 },
      { name: "Median latency", target: "≤ 4000 ms", value: `${lat.median_ms} ms`, pass: lat.median_ms <= 4000 },
    ],
    notes: [
      `Usable on the first try: ${firstTry}/${n}. Raw answers with person words before the guard: ${personRaw}. Over budget: ${overBudget}.`,
      "Key fact = the scene mentions at least one item from evals/datasets/photos.json expect_any (a proxy for the lab's hand grade).",
      "Suspect names are capitalised words outside the sign text in the photo; each one is reviewed by hand in docs/ml/eval-results.md.",
    ],
    items: rows,
  };
}
