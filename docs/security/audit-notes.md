# npm audit notes

For the security role. One entry per finding we keep rather than fix, with the proof and what would make us look again.

## 2026-10-11: 5 moderate, one chain under @mastra/core (branch `mastra-plan`, ADR-0025)

`npm audit` after adding `@mastra/core` 1.68.0 to apps/server:

| Package | Version installed | Why flagged |
| --- | --- | --- |
| sprintf-js | 1.0.3 | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c): denial of service through unbounded precision specifiers. Range `*`: no fixed version. |
| argparse | 1.0.10 (nested under gray-matter) | depends on sprintf-js |
| js-yaml | 3.15.2 (nested under gray-matter) | depends on argparse 1 |
| gray-matter | 4.0.3 | depends on js-yaml 3 |
| @mastra/core | 1.68.0 | depends on gray-matter |

### Can we upgrade?
No.
- sprintf-js: the advisory covers every version (latest is 1.1.3).
- argparse 1.0.10 is the last 1.x, and js-yaml 3.15.2 is the last 3.x.
- gray-matter 4.0.3 is the latest release.
- Every @mastra/core release we checked (1.69.0, 1.75.0) still depends on `gray-matter ^4.0.3`. The fix npm suggests is `@mastra/core@1.0.4`, a downgrade with breaking changes.
- An `overrides` entry forcing js-yaml 4 would break gray-matter, which calls the js-yaml 3 API.

### Is the vulnerable code on our path?
No. sprintf-js and argparse never load in the server. js-yaml 3 loads but does not use argparse.
- **Import graph.** The Plan agent imports `@mastra/core/agent` and `@mastra/core/tools` only, never the `Mastra` class. That graph does load gray-matter, statically:
  - `dist/agent/index.js -> agent-2tbxNTpS.js -> agent-skills-resolver-C0WK_MKv.js -> gray-matter`
  - the same chain through `workspace-skills-BihrOY_x.js` and `workspace-gT-8Ny5M.js`
- **gray-matter** requires js-yaml 3 (`gray-matter/lib/engines.js`). Mastra calls it only to read the front matter of skill files (`SKILL.md`). Our agent sets no skills and no workspace, so gray-matter is loaded but never called.
- **js-yaml 3** requires argparse only in its command-line tool (`bin/js-yaml.js`). Nothing in `index.js` or `lib/` mentions argparse.
- **argparse 1** is the only user of sprintf-js (`lib/argument_parser.js`), so sprintf-js is never loaded either.
- **Runtime proof.** `apps/server/test/mastra-import-graph.test.ts` runs a full agent turn and then reads Node's module cache:
  - gray-matter is present, which shows the check can see CommonJS loads;
  - argparse and sprintf-js are absent.
  The same test checks that js-yaml 3's library files never name argparse. It fails if an upgrade changes any of this.
- **Even if sprintf-js loaded,** the bug needs an attacker-chosen format string. No Flare input reaches a format string.

### Decision
Keep @mastra/core 1.68.0 with these findings recorded. The flag `LADDER_AGENT` is off by default, so production does not load Mastra at all (the module is imported on the first agent request).

### Look again when
- a @mastra/core release drops gray-matter or moves to js-yaml 4 (check each upgrade, pinned exact, at least 2 weeks old);
- the agent starts using Mastra skills or workspaces;
- `mastra-import-graph.test.ts` fails.
