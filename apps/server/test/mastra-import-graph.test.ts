// docs/security/audit-notes.md: the 5 moderate npm audit findings are one chain,
// @mastra/core -> gray-matter 4.0.3 -> js-yaml 3.15.2 -> argparse 1.0.10 -> sprintf-js 1.0.3
// (GHSA-hp3w-g68c-fv3c, no fixed sprintf-js). The Plan agent loads gray-matter and js-yaml 3
// (Agent imports Mastra's skills code), but js-yaml 3 uses argparse only in its command-line
// tool, so argparse and sprintf-js never load. These tests keep that true across upgrades.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runLadderAgent } from "../src/agent/ladder-agent.ts";
import type { HubRelay } from "../src/hub/relay.ts";

const require = createRequire(import.meta.url);
const core = dirname(require.resolve("@mastra/core/package.json"));
const gm = dirname(createRequire(join(core, "package.json")).resolve("gray-matter/package.json"));
const yaml3 = dirname(createRequire(join(gm, "package.json")).resolve("js-yaml/package.json"));
const pkg = JSON.parse(readFileSync(join(core, "package.json"), "utf8")) as {
  exports: Record<string, { import?: { default?: string } }>;
};

// Static imports and re-exports start a line in the built chunks; import("...") can be anywhere.
const SPEC = /^(?:import|export)\b[^;'"]*?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;

/** Bare packages reached from these @mastra/core entry points (static, re-export and import()). */
function packagesFrom(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const out = new Set<string>();
  const todo = entries.map((e) => resolve(core, pkg.exports[e]?.import?.default ?? ""));
  while (todo.length) {
    const f = todo.pop() as string;
    if (seen.has(f) || !existsSync(f)) continue; // a path inside a doc comment, not a module
    seen.add(f);
    for (const m of readFileSync(f, "utf8").matchAll(SPEC)) {
      const s = m[1] ?? m[2] ?? "";
      if (s.startsWith(".")) todo.push(resolve(dirname(f), s));
      else if (!s.startsWith("#") && !s.startsWith("node:"))
        out.add(s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : (s.split("/")[0] ?? s));
    }
  }
  return out;
}

const jsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith(".js") ? [p] : [];
  });

describe("npm audit chain under @mastra/core (docs/security/audit-notes.md)", () => {
  it("the agent and tools entries do load gray-matter (so the proof below matters)", () => {
    expect(packagesFrom(["./agent", "./tools"]).has("gray-matter")).toBe(true);
  });

  it("js-yaml 3's library never requires argparse; only its bin/ tool does", () => {
    const lib = [join(yaml3, "index.js"), ...jsFiles(join(yaml3, "lib"))];
    expect(lib.filter((f) => readFileSync(f, "utf8").includes("argparse"))).toEqual([]);
    expect(readFileSync(join(yaml3, "bin", "js-yaml.js"), "utf8")).toContain("argparse");
  });

  it("after a full agent run, argparse and sprintf-js are not loaded", async () => {
    const relay = {
      status: "connected",
      ladder: async () => ({
        ok: true,
        ladder: ["Walk", "Loop", "Lap", "Sit"].map((label, i) => ({
          step: i + 1,
          label,
          minutes: [60, 30, 15, 10][i],
        })),
      }),
    } as unknown as HubRelay;
    const out = await runLadderAgent(
      { relay, cloud: null, budgetMs: 8000, fetch: null },
      { ask: "walk", total_minutes: 60 },
      {
        set() {},
      },
    );
    expect(out.tier).toBe("hub");
    const loaded = Object.keys(require.cache);
    expect(loaded.some((k) => k.includes("/gray-matter/"))).toBe(true); // the check can see CommonJS loads
    expect(loaded.some((k) => k.includes("/argparse/"))).toBe(false);
    expect(loaded.some((k) => k.includes("/sprintf-js/"))).toBe(false);
  });
});
