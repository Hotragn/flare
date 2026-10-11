// Report writer: one JSON (machine) and one Markdown (people) file per task and tier.
// Reports hold model outputs for our eval items only; never real user input.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EVALS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export type Bar = { name: string; target: string; value: string; pass: boolean };

export type Report = {
  task: string;
  tier: string;
  model: string;
  prompt: string; // id@version
  date: string;
  n: number;
  bars: Bar[];
  latency?: { median_ms: number; p95_ms: number; max_ms: number };
  notes: string[];
  items: Record<string, unknown>[];
};

export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
}

export const latency = (ms: number[]) => ({
  median_ms: percentile(ms, 50),
  p95_ms: percentile(ms, 95),
  max_ms: Math.max(0, ...ms),
});

export function toMarkdown(r: Report): string {
  const lines = [
    `# Eval: ${r.task} (${r.tier} tier)`,
    "",
    `Model: ${r.model}. Prompt: ${r.prompt}. Date: ${r.date}. Items: ${r.n}.`,
    "",
    "| Bar | Target | Measured | Pass |",
    "| --- | --- | --- | --- |",
    ...r.bars.map((b) => `| ${b.name} | ${b.target} | ${b.value} | ${b.pass ? "yes" : "NO"} |`),
  ];
  if (r.latency)
    lines.push(
      "",
      `Latency: median ${r.latency.median_ms} ms, p95 ${r.latency.p95_ms} ms, max ${r.latency.max_ms} ms.`,
    );
  if (r.notes.length) lines.push("", "## Notes", "", ...r.notes.map((n) => `- ${n}`));
  lines.push("", `Per-item results: \`${r.task}-${r.tier}.json\`.`, "");
  return lines.join("\n");
}

export function writeReport(r: Report): string {
  const dir = join(EVALS_DIR, "reports");
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `${r.task}-${r.tier}`);
  writeFileSync(`${base}.json`, `${JSON.stringify(r, null, 2)}\n`);
  writeFileSync(`${base}.md`, toMarkdown(r));
  return `${base}.md`;
}

export const allPass = (r: Report) => r.bars.every((b) => b.pass);
