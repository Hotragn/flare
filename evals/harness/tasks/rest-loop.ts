// Rest-loop request extraction (FR-AI-10, SRS-REST-1). Rules tier only: requests never leave
// the phone (SRS-PRIV-1). `--parser <module>` runs another extractor exporting parseRestRequest.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { countWords } from "../../../packages/shared/src/prompts/guard.ts";
import {
  parseRestRequest,
  REST_EXTRACTOR_VERSION,
  type RestRequestT,
  restReadBack,
} from "../../../packages/shared/src/prompts/rest-loop.ts";
import { dataset, REPO_DIR } from "../paths.ts";
import type { Report } from "../report.ts";

type Item = { id: string; text: string; expect: RestRequestT | null; hard?: string };

export function sameRequest(got: RestRequestT | null, exp: RestRequestT | null): boolean {
  if (exp === null || got === null) return got === exp;
  return (
    got.minutes === exp.minutes &&
    got.rest_gap_m === exp.rest_gap_m &&
    got.avoid_steps === exp.avoid_steps &&
    got.mobility_hint === exp.mobility_hint &&
    [...got.prefer].sort().join() === [...exp.prefer].sort().join()
  );
}

export async function runRestLoop(tier: string, parserPath?: string, limit?: number): Promise<Report> {
  const items = dataset<{ items: Item[] }>("rest-loop-requests.json").items.slice(0, limit);
  let parse = parseRestRequest;
  let name = `packages/shared/src/prompts/rest-loop.ts@${REST_EXTRACTOR_VERSION}`;
  if (parserPath) {
    const mod = (await import(pathToFileURL(join(REPO_DIR, parserPath)).href)) as {
      parseRestRequest?: typeof parseRestRequest;
    };
    if (!mod.parseRestRequest) throw new Error(`${parserPath} exports no parseRestRequest()`);
    parse = mod.parseRestRequest;
    name = parserPath;
  }
  const rows = items.map((it) => {
    const got = parse(it.text);
    const rb = got ? restReadBack(got) : null;
    return {
      id: it.id,
      hard: it.hard ?? null,
      text: it.text,
      expect: it.expect,
      got,
      pass: sameRequest(got, it.expect),
      readback: rb,
      readback_words: rb ? countWords(rb) : 0,
    };
  });
  const plain = rows.filter((r) => !r.hard);
  const hard = rows.filter((r) => r.hard);
  const plainOk = plain.filter((r) => r.pass).length;
  const hardOk = hard.filter((r) => r.pass).length;
  const over = rows.filter((r) => r.readback_words > 12).length;
  const ac1 = rows.find((r) => r.id === "R01")?.pass ?? false;
  return {
    task: "rest-loop",
    tier,
    model: `none (rules): ${name}`,
    prompt: "n/a (no model; SRS-PRIV-1)",
    date: new Date().toISOString(),
    n: rows.length,
    bars: [
      { name: "E16-S1 AC1 example", target: "pass", value: ac1 ? "pass" : "fail", pass: ac1 },
      {
        name: "Plain requests, all fields right",
        target: `≥ ${plain.length - 1}/${plain.length}`,
        value: `${plainOk}/${plain.length}`,
        pass: plainOk >= plain.length - 1,
      },
      { name: "Hard requests (reported)", target: "report", value: `${hardOk}/${hard.length}`, pass: true },
      { name: "Read-backs over 12 words", target: "0", value: String(over), pass: over === 0 },
    ],
    notes: [
      "A wrong field is caught by the read-back: the person sees it and edits it before any loop is built (SRS-REST-1).",
    ],
    items: rows,
  };
}
