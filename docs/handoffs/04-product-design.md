# Handoff 04: Product design to Motion and Copy

From: UI/UX designer. Date: Sat 2026-10-10. Next roles: Motion and sound, then Copy (UX writing).

## What was delivered

| Path | Contents |
| --- | --- |
| docs/design/01-brief-and-ux-scan.md | Brief, targets, 7 principles, competitive UX scan, proposed stack |
| docs/design/02-flows-and-ia.md | IA, routes, screen inventory (33 screens), 6 flows (Mermaid) |
| docs/design/03-wireframes.md | 33 wireframes, rendered from the same code with `data-wire` |
| docs/design/04-hifi-screens.md | Index of 189 hi-fi PNGs (every state × theme) and the layout spec |
| docs/design/05-design-system.md | Tokens (CSS + JSON) and 16 components with props, states, accessibility |
| docs/design/06-website.md | Website sections W0 to W7, mobile and desktop |
| docs/design/07-accessibility.md, 07-annex-focus-order.md | Contrast, focus order (measured), labels, targets, motion, known gaps |
| docs/design/08-copy-deck.md | 85 extracted button and headline strings with word counts |
| design/system/ | `build-tokens.mjs` → `tokens.css`, `tokens.json` |
| design/prototype/ | SvelteKit 3.0.1 + Svelte 5.57.2 + Bits UI 2.19.5 prototype: `/proto` (7 key moments), `/screens`, `/screens/{id}`, `/components`, `/site` |
| design/exports/ | screens/ (189), wireframes/ (33), pages/ (site mobile and desktop, components, prototype), a11y-report.json, focus-audit.json |

## Proof

| Check | Result |
| --- | --- |
| `npm run check` (svelte-check, TypeScript 6.0.3) | 0 errors, 0 warnings, 697 files |
| `npm run build` | static site written |
| `npm run export` | 189 screen PNGs, 33 wireframes, 4 full pages, 0 page errors |
| `npm run a11y` (axe-core 4.14.0) | 193 targets, 0 violations (first run 90, 17 serious; all fixed) |
| `scripts/focus-audit.mjs` | 92 states, 0 targets under 44 px (first run 4; fixed) |
| `scripts/copy-lint.mjs` | 85 strings, 0 over the limits, 0 banned words |
| JS weight (gzipped, measured in Chrome) | invite screen 51.1 KB; website 48.5 KB (budget 150 KB, SRS-PERF-2) |
| Horizontal scroll | none at 390 and 1440 px |
| `npm audit` | 0 vulnerabilities (after the override in BUG-007) |

Run it: `cd design/prototype && npm ci && npm run build && npm run preview`, then open `http://127.0.0.1:5318/proto/`.

## Key decisions and why

1. **The flame is the interface** (founder feedback folded in). FlameMeter puts the live flame and the count together on the invite, the host's draft, the Ember and the Plan invite. Hearth places it on ground with a pine horizon and sparks on Lit.
2. **The photo moment:** the print develops over 2.4 s while six words arrive one every 220 ms. The lab measured the hub at about 3.0 s per photo, so the develop covers the wait. If the hub can't be reached, a six-word field appears with a template placeholder.
3. **Compass as a warm light:** the brand pin-flame is the pointer, with its hole on the dial centre. Three rings pull in as distance halves; facing within 15° lights the gold dot and a breathing glow.
4. **Sun mode** on every outdoor screen (H5, H6, I6, I7, I8, I9, P5, P6).
5. **Stack:** Svelte 5 + SvelteKit 3 + Bits UI. Headless, accessible primitives, and small bundles (51 KB on the invite). The architect confirms in a decision record. SvelteKit 3 needed migration work (BUG-008).
6. **Honesty in UI:** the "AI on this phone" screen says photo AI doesn't fit in a phone browser yet (lab result). The privacy page leaves a block for the real audit output instead of fake numbers.

## For Motion and sound (exact specs to produce)

What exists in code now (tokens: `--dur-*`, `--ease-*`; all off with reduced motion):

| Moment | Prototype now | Motion role must specify |
| --- | --- | --- |
| Kindling grows per yes | Flame scales 55% → 90% with `--ease-spring`, 260 ms; glow widens | Step sizes per quorum (2 to 6), overshoot, and the sound (brand: "small dry tick") |
| Lit catches | Flicker loop, gold dot pulse, 9 sparks rising for 1.6 s, ground glow | The catch sequence (brand: grow to full, dot lights gold, one pulse, 480 ms), the "warm whump" under 600 ms, one haptic, and the WebGL shader (lab: 1.9 KB) vs CSS fallback |
| Ember settles | Dome settles from scaleY 1.6, 480 ms | Settle curve, the soft low note |
| Gone drifts | Smoke drifts up 6 px and fades in, 900 ms | Drift path and timing; silence |
| Print develops | Sepia, blur and brightness to full over 2.4 s | Whether to sync the reveal to the hub response, plus a "chemical" edge or flash |
| Six words | Word-by-word, 220 ms each, spring rise | Timing relative to the develop |
| Compass | Rings move with distance; facing glow breathes 1.8 s | Speech cadence (SRS-CMP-2), the facing tick tone (iOS has no `navigator.vibrate`) |
| Sheets | Rise 24 px with fade, 260 ms | Enter and exit, drag to dismiss |
| Buttons | Press scale 0.985, 90 ms | Final press feel |

## For Copy (UX writing)

- Start from docs/design/08-copy-deck.md (85 strings) and the dynamic templates below. Keep the fixed strings from the SRS exactly as written.
- Dynamic templates used: "{Host} is waiting at {spot}.", "Need {N} more.", "{N} in, {Q} to go ahead. Nobody sees who.", "Met here {N} times", "Smaller plan: 15 min at {bench}.", "It's on: {step} at {time}.", "{Name}, {meters} meters, {direction}.", "{Name} is straight ahead.", "Answer by {time}.", "Got it: {rules}. Right?"
- Still to write (no UI string exists yet): the Telegram bot messages (post, private reply, lit, cleanup), the 200-byte plain-text form for every Fairlane spot name, push notification text, the iOS share-sheet text and link preview text, the empty and error copy for `/check` failures beyond the samples, and the README.
- Tone reference: docs/brand/01-strategy.md voice table.

## Things to know

- Screen components take `view`, not `state`, because `state` collides with the `$state` rune.
- Imports use `#lib/...` with the file extension; tokens and icons are copied in by `scripts/sync-assets.mjs` before dev, build and check.
- Sample content (names, places, distances, the Spark line) lives in `src/lib/sample.ts`. The pond scene is an illustration; replace it with real field photos after Sunday.
- The RTM `design` column is filled: 72 UI requirements point to screens or components; the other 87 are marked "No UI". The trace check passes.
- Sheets in static exports are drawn inline; the live Sheet uses Bits UI Dialog with a focus trap.
- `lab/` is read-only for us.

## Change requests

None against earlier phases. Small fixes made during this phase: brand icon set grew from 16 to 24 icons (close, mic, menu, edit, share, chevron, info, warning) in brand/tools/build.mjs.
