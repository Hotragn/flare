# Common brief for all nine specialists

Read this first, then your own brief. Written by the engineering lead, Sat 2026-10-10 20:45 ET.

## The project
Flare: a group invite app for the DEV Hacktoberfest Week 1 "Touch Grass" challenge. Release candidate (RC) Sun 2026-10-11 10:00 ET; field test 11:00 to 15:00 ET near Fairlane Town Center, Dearborn MI, on four iPhones (13, 16 Pro Max, 17 Pro, 17 Pro Max); DEV deadline Mon 06:59 UTC.

## Read before you write code
1. docs/handoffs/ (01 to 08), especially 07-architect.md and 08-engineering-lead.md.
2. docs/architecture/README.md and the docs it lists that touch your area; contracts in docs/architecture/contracts/.
3. docs/engineering/01-work-breakdown.md (your WPs), 02-interface-control.md (frozen interfaces), 04-dependencies-and-process.md (definition of done).
4. docs/requirements/01-srs.md and 03-business-rules.md for the rules you implement.
5. lab/reports/ for evidence (read-only; never edit or commit lab/).

## Setup in your worktree
- You are in your own git worktree. First: `git branch -m wp/<your-area>` (names in RESUME.md), then `npm ci`.
- Secrets: `export FLARE_ENV_FILE="/Users/hotragn/Documents/Claude Code/HacktoberFest/flare/.env"`. Never print, log or commit any value. `npm run check-env` shows set/missing only.
- Node 24+ runs .ts directly. Imports carry the .ts extension. No enums, namespaces or parameter properties (erasableSyntaxOnly).
- Use only your port range (in your brief) for any server you start, so parallel agents don't collide.
- Ollama (gemma4:e4b-it-q4_K_M) runs on this Mac and is shared: keep model calls small and sequential.
- Google Chrome is installed; drive it with playwright-core `chromium.launch({ channel: "chrome" })`. Don't download browsers.

## Rules
- Build against the frozen interfaces only (packages/shared/src/icd/, openapi.yaml, asyncapi.yaml). For anything another specialist provides, write your own fake in your test folder (`test/fakes/`). Don't wait for anyone.
- An interface change is an `icd/` change: write it in your handoff under "Interface change requests" with the exact diff; do not change another area's files. Additive changes to openapi.yaml for endpoints you own are allowed; keep `npm run contracts` green.
- Edit only the paths your brief says you own. Exceptions: you may add dependencies to your own workspace's package.json (exact versions, latest stable, checked with `npm view`), and you may add new keys to design/prototype/src/lib/copy/deck.json (add, never change or remove; run its copy-lint).
- Bugs: write them in docs/engineering/bugs/<your-area>.md with ids BUG-<AREA>-1, -2… in the BUGLOG format (date, area, symptom, cause, fix, proof). The lead merges them into docs/BUGLOG.md.
- Quality bar: no TODOs, no stubs, no fake data in production code; tests for every rule, named with the rule id; error handling; types; docs. Latest stable versions.
- Privacy: nothing readable leaves the phone except as the contracts allow; never log bodies, ids, names, places, coordinates, conditions or tokens; new tables need expires_at and cascade.
- Writing rules for docs and UI copy: plain words, short sentences, a number or proof for every claim. Banned words: seamless, leverage, robust, empower, unlock, elevate, delve, cutting-edge, revolutionize, game-changer, harness, synergy, holistic, paradigm, next-level, supercharge, effortless, ecosystem, tapestry, testament. No em-dash chains, no emoji in docs. Buttons ≤ 3 words, messages ≤ 12 words.
- Anything public waits for the founder: no deploys, no making things public, no posting, no messaging people, no setWebhook, no OSM uploads. Pushing your branch to the private repo origin (Hotragn/flare) is allowed.

## Working rhythm (usage limits can stop you at any time)
- Commit early and often on your branch (at least every 30 to 45 minutes of work), message ending with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Keep docs/engineering/notes/<area>-progress.md current: done, in progress, exact next step. Commit it with each checkpoint. If you are restarted, read it first and continue from it.
- Before each commit: `npm run lint && npm run typecheck && npm test` (and `npm run contracts` if you touched the API or hub protocol).
- Push your branch to origin after each checkpoint: `git push -u origin wp/<your-area>`.

## Done
Your brief's deliverables, all finished, tests green, `npm run ci` green on your branch, your handoff written, final commit pushed. Your final message to the lead: what was built, proof (commands and numbers), anything not done and why, interface change requests, copy keys added.
