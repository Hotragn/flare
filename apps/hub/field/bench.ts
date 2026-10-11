// Hub performance check for docs/ai-runtime/performance.md. Sequential and small, because
// Ollama is shared on this Mac.
//   photo: POST each JPEG in <dir> to <server>/api/v1/drafts (phone -> server -> hub -> Ollama)
//   ladder: five ask lines straight to Ollama with the hub's ladder job code
// Usage: node apps/hub/field/bench.ts --server http://localhost:8843 --photos <dir of 768 px JPEGs>
// Prints timings and tiers only, never the drafts (they describe the photos).
import fs from "node:fs";
import path from "node:path";
import { ladderFromAsk } from "../src/ollama.ts";

const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const server = arg("--server");
const dir = arg("--photos");
const ollama = {
  url: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL ?? "gemma4:e4b-it-q4_K_M",
  timeoutMs: 30_000,
};
const pct = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;
const out: Record<string, unknown> = {};

if (server && dir) {
  const ms: number[] = [];
  const tiers: string[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jpg"))) {
    const body = fs.readFileSync(path.join(dir, f));
    const t = performance.now();
    const res = await fetch(`${server}/api/v1/drafts`, {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body,
    });
    const j = (await res.json()) as { tier?: string; invite?: string };
    ms.push(Math.round(performance.now() - t));
    tiers.push(`${j.tier}:${(j.invite ?? "").split(/\s+/).filter(Boolean).length}w`);
  }
  out.photo = { n: ms.length, round_trip_ms: ms, median_ms: pct(ms, 0.5), max_ms: Math.max(...ms), tiers };
}

const ASKS = [
  "Fairlane walk at 11?",
  "Lunch outside by the pond",
  "Frisbee in Ford Woods after work",
  "Coffee and a loop around the mall",
  "Sunset sit at the park",
];
const lms: number[] = [];
const lok: boolean[] = [];
const labels: number[] = [];
for (const [i, ask] of ASKS.entries()) {
  const t = performance.now();
  const steps = await ladderFromAsk(ollama, {
    type: "job",
    id: `00000000-0000-4000-8000-00000000000${i}`,
    kind: "ladder-draft",
    ask,
    total_minutes: 60,
  });
  lms.push(Math.round(performance.now() - t));
  lok.push(!!steps);
  if (steps) labels.push(...steps.map((s) => s.label.split(/\s+/).length));
}
out.ladder = {
  n: ASKS.length,
  ms: lms,
  median_ms: pct(lms, 0.5),
  max_ms: Math.max(...lms),
  usable: `${lok.filter(Boolean).length}/${ASKS.length}`,
  within_8s: `${lms.filter((m) => m <= 8000).length}/${ASKS.length}`,
  label_words_max: Math.max(0, ...labels),
};
console.info(JSON.stringify(out, null, 2));
