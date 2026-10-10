# ADR-0002: SvelteKit 3, Svelte 5 and Bits UI for the app and link page

Status: Accepted. Date: 2026-10-10. Confirms the product designer's choice (handoff 04).

## Context
The link page must be interactive in 2.0 s on an iPhone 13 over 4G and ship at most 150 KB of gzipped JavaScript (SRS-PERF-1, SRS-PERF-2). Every screen must meet WCAG 2.2 AA with 0 serious axe issues (SRS-A11Y-1, -2). The prototype of all 33 screens already exists in SvelteKit.

## Decision
SvelteKit 3.0.1, Svelte 5.57.2, Vite 8.3.4, `@sveltejs/adapter-static` 4.0.0, Bits UI 2.19.5 for dialogs and toggle groups. The server serves the static build; there is no Node rendering server. The prototype's components, tokens, copy deck and screens move into `apps/web` as they are built for real.

## Numbers
- Prototype invite route: 61.6 KB gzipped JS (handoff 05), 41% of the budget. Current `apps/web` build: 57.1 KB for all routes (`npm run budget`).
- Prototype: axe 0 violations on 193 targets, 0 touch targets under 44 px (handoff 06).

## Consequences
- Config lives in the Vite plugin (SvelteKit 3); `$lib` is replaced by `#lib/*` subpath imports with file extensions (BUG-008); `@sveltejs/kit` is pinned by an npm override (BUG-007).
- Static output means no per-request HTML; link previews come from a tiny server route that returns only the Open Graph tags (ADR-0017).

## Options weighed
| Option | Result |
| --- | --- |
| React 19.3.0 + react-aria-components 1.22.1 | Accessible, but React DOM alone is about 60 KB gzipped before any app code |
| Plain HTML + web components | Smallest, but rebuilds what Bits UI already gives (focus trap, roving focus) |
