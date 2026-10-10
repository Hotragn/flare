# Flare: Design brief and competitive UX scan

Owner: Product design. Version 1.0, Sat 2026-10-10. Inputs: handoffs 01 to 03, PRD v1.1, SRS, brand book.

## 1. Brief

**Problem.** Friends want to meet outside but asking is awkward, nobody wants to arrive alone, and plans stall in the chat (BRD section 1).

**Design goal.** Make saying yes take one tap and a few seconds, make "it's on" feel like a small celebration, and make the last screen of every flow point outside.

**Targets (from the SRS, they are requirements):**

| Moment | Target |
| --- | --- |
| Host: open to sent | ≤ 15 s (SRS-CRE-9) |
| Invitee: open to "I'm in" | ≤ 10 s (SRS-RES-7) |
| Link page interactive | ≤ 2.0 s on iPhone 13 over 4G (SRS-PERF-1) |
| Contrast | WCAG 2.2 AA everywhere; body text ≥ 7:1 (brand contrast table) |
| Touch targets | ≥ 44 × 44 pt (SRS-A11Y-6); primary actions 56 pt tall |

**Principles**

1. **One main action per screen,** in the thumb zone (bottom 40% of the screen), full width, 56 pt tall.
2. **Built for outside.** Screens used outdoors run in sun mode: light roles, 1.15× text, no thin type, no low-contrast decoration (brand book section 3).
3. **The phone wants to go back in your pocket.** Every flow ends on a screen whose message points outside ("Go. They're by the pond.") with no further navigation, and whose primary action is optional.
4. **The flame is the interface.** Progress, success and failure are shown by the flame's state (Kindling grows, Lit catches, Ember settles, Gone drifts), not by spinners, badges or bars.
5. **Magic moments, earned.** The photo develops like a print while the six words type in. Lit is a short celebration with sound and one haptic. Both respect Reduce Motion.
6. **Private by construction.** No screen ever shows who said yes, who faded, or why someone moved to an Ember (SRS-RES-4, SRS-ACC-4).
7. **Accessible equals.** Every screen works with VoiceOver, the largest text size, and without color.

**Out of scope for design:** feeds, profiles, streaks, badges, a No button, chat (PRD non-goals).

## 2. Competitive UX scan

Source: 813 Week 1 entries (docs/research/00), the 12 top entries read in full, and the 17 Weekend winners. What their interfaces do, and what we take or avoid.

| Pattern seen | Where | Our move |
| --- | --- | --- |
| Chat-style AI screen as the main UI | Most "trail planner" and "quest" entries (23% and 16% of titles) | Avoid. No chat. AI output is six words and a 20-word scene. |
| "Screen-off" counter or lock screen | Drift (screen-on 2m5s), DeskBreak (locks the screen), ZSDM (screen-off score) | Take the idea, measure it privately (screen seconds as a bucket, KPI 4), never show a score. |
| Audio-first while walking | ZSDM, Drift | Take it: the talking compass works with the screen down. |
| Printable card instead of a screen | TrailTruth (weekly go/no-go card), Nature Bingo | Take it: Bench to Bench large-print card. |
| Photo proof judged by AI | 6% of entries, Side Quest | Avoid (out of scope). The photo is an invitation, not evidence. |
| Gamified XP, levels, creatures | Side Quest (hatches creatures), TouchGrass (XP, level 5 unlocks) | Avoid. Delight comes from the flame and from people arriving. |
| Map-heavy screens | 10% use Leaflet/MapLibre maps | Avoid as the main view. A compass and a sentence beat a map outdoors. |
| Weather or frost dashboards | PLOT, FrostWise, Tendril | Avoid dashboards. One nature line per Flare. |
| Desktop-first layouts | Side Quest runs on a desktop "home base" | Avoid. Phone-first, iPhone Safari, one column. |
| Group play | IRL Clash (strangers, competitive rounds) | Different: friends, cooperative, private. |
| Long setup before value | Many: model downloads, accounts, settings | Avoid. Value in the first 10 s; model download is opt-in later. |

Gaps no entry fills, which our UI owns: a private yes with a visible count only; a plan that shrinks on screen instead of failing; an access line under every invite; a spoken scene for screen readers; a last screen that sends you outside.

## 3. Stack for the prototype (proposed; the architect confirms)

The prototype is real code meant to carry into the app.

| Choice | Version (checked Oct 10) | Why |
| --- | --- | --- |
| Svelte | 5.57.2 | Compiles away; small bundles fit the 150 KB gzipped cap on the link page (SRS-PERF-2) |
| SvelteKit | 3.0.1 | Routing, static export, service worker support |
| Vite | 8.3.4 | Build tool used by SvelteKit |
| Bits UI | 2.19.5 | Headless, accessible primitives for Svelte 5 (dialog, toggle group, slider, tabs) with keyboard and screen reader support |
| @fontsource Fraunces and Atkinson Hyperlegible Next | 5.3.0 | Self-hosted OFL fonts (no third-party font requests, SRS-PRIV-7) |
| playwright-core | 1.64.0 | Screenshots through the installed Chrome (no browser download) |
| axe-core | latest stable | Automated accessibility checks on every screen |

Considered: React 19.3.0 with React Aria Components 1.22.1 (excellent accessibility, larger runtime) and Radix. Motion: the Web Animations API and Svelte transitions, no animation library, to stay inside the size budget.
