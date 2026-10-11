// Fix the map tag drafts (FR-MAP-2, SRS-MAP-1, BR-AI-4, WP ML5 "allow-list test").
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasPersonWords } from "../../../packages/shared/src/prompts/guard.ts";
import { enforceOsmTags, OSM_PROMPT, OsmTags } from "../../../packages/shared/src/prompts/osm-tags.ts";
import { chat, MODEL, warmImage } from "../ollama.ts";
import { dataset, labDir, readJson } from "../paths.ts";
import { latency, type Report } from "../report.ts";

type Item = { id: string; must: Record<string, string>; may: string[]; also_ok?: Record<string, string[]> };

export async function runOsmTags(tier: string, limit?: number): Promise<Report> {
  const items = dataset<{ items: Item[] }>("osm-tags.json").items.slice(0, limit);
  const n = items.length;
  const base = {
    task: "osm-tags",
    tier,
    date: new Date().toISOString(),
    n,
    prompt: `${OSM_PROMPT.id}@${OSM_PROMPT.version}`,
  };
  if (tier === "rules") {
    return {
      ...base,
      model: "none (manual tag picker)",
      bars: [{ name: "Picker offers only allow-list keys", target: "yes", value: "yes", pass: true }],
      notes: ["The floor is the manual picker built from OSM_ALLOW; it cannot produce an off-list key."],
      items: [],
    };
  }
  const lab = labDir();
  if (!lab) throw new Error("lab/data/photos not found; set FLARE_LAB_DIR");
  const manifest = readJson<{ id: string; file: string; use: boolean }[]>(join(lab, "data", "photos", "photos.json"));
  const w0 = manifest.find((x) => x.id === items[0]?.id);
  const warmMs = w0
    ? await warmImage(OSM_PROMPT.system, readFileSync(join(lab, "data", "photos", w0.file)).toString("base64"))
    : 0;
  const rows: Record<string, unknown>[] = [];
  const ms: number[] = [];
  let parsed = 0;
  let offList = 0;
  let rawOff = 0;
  let mustOk = 0;
  let person = 0;
  for (const it of items) {
    const m = manifest.find((x) => x.id === it.id);
    if (!m?.use) throw new Error(`photo ${it.id} missing or not cleared`);
    const b64 = readFileSync(join(lab, "data", "photos", m.file)).toString("base64");
    const r = await chat({
      system: OSM_PROMPT.system,
      user: OSM_PROMPT.user,
      imageBase64: b64,
      numPredict: OSM_PROMPT.numPredict,
    });
    ms.push(r.ms);
    const d = enforceOsmTags(r.text);
    if (d) parsed++;
    if (d?.dropped.length) rawOff++;
    if (d && !OsmTags.safeParse(d.tags).success) offList++;
    if (hasPersonWords(r.text)) person++;
    const tags = d?.tags ?? {};
    const ok = Object.entries(it.must).every(
      ([k, v]) => tags[k] === v || (it.also_ok?.[k] ?? []).includes(tags[k] ?? ""),
    );
    if (d && ok) mustOk++;
    rows.push({
      id: it.id,
      ms: r.ms,
      tags,
      dropped: d?.dropped ?? null,
      must: it.must,
      must_ok: ok,
      raw: r.text.slice(0, 300),
    });
  }
  const lat = latency(ms);
  return {
    ...base,
    model: MODEL,
    latency: lat,
    bars: [
      { name: "Parsed answers", target: `${n}/${n}`, value: `${parsed}/${n}`, pass: parsed === n },
      { name: "Off-list tags after the guard", target: "0", value: String(offList), pass: offList === 0 },
      { name: "Required tags drafted", target: `≥ ${n - 1}/${n}`, value: `${mustOk}/${n}`, pass: mustOk >= n - 1 },
      { name: "Person words in the answer", target: "0", value: String(person), pass: person === 0 },
      { name: "p95 latency", target: "≤ 8000 ms", value: `${lat.p95_ms} ms`, pass: lat.p95_ms <= 8000 },
    ],
    notes: [
      `Image warm-up before timing: ${warmMs} ms (not counted).`,
      `Answers with at least one off-list or bad-value key before the guard: ${rawOff}/${n} (dropped, never shown).`,
    ],
    items: rows,
  };
}
