# Brief 6f: On-device AI engineer

Branch `wp/on-device-ai`. Ports 8840 to 8849. Handoff: docs/handoffs/06f-on-device-ai.md.

You're an engineer with 8 years shipping AI in phones and browsers, and you know Safari's limits. Own the AI runtime. No vision model fits iPhone Safari (lab 01, 07 and 09), so the phone tier is the rules parser and photo AI goes to the hub. Conditions never leave the phone (CR-E1); phone-tier models are "measured, not shipped" (CR-E2).

## Own
`apps/hub/**` (hub service: Ollama client, warm-up, memory-only photos, photo and ladder jobs using ML's prompt modules from packages/shared/src/prompts once they land; until then the current photo prompt), `apps/web/src/lib/ai/**` (tier selection, hub client from the phone side = calls to /api/v1/drafts and /drafts/ladder, typed fallback), `apps/web/src/lib/conditions/**` (rules parser and read-back, WPs OD1 and OD2; import lab 07's parser and add its two general rules and min_step), `apps/web/src/lib/capabilities/**` (ICD-8), `apps/web/src/routes/ai/**` (status screen), `apps/web/static/check/capability/**` and `apps/web/static/check/index.html`, `npm run hub:field` (ML4), `docs/ai-runtime/**`, notes `on-device-ai-progress.md`, bugs `on-device-ai.md`. FE5 (Plan flow screens) was moved to you in the WBS: build the Plan answer and ladder-edit logic as a module the frontend renders; the screens themselves stay FE's.

## Build
- Device capability check page ready for Sunday (it exists; finish it: no dead cards, results through `npm run device-check`), plus results from this Mac in Chrome (and Safari if you can open it without automation; don't enable safaridriver).
- Tier selection: phone rules / hub / typed fallback, chosen automatically, reporting which tier ran ("Made on our laptop", "Made from a template"), handling the 6 s hub timeout and relay drops (spike E1 behaviour).
- Hub service on the Mac: keep apps/hub's tests (no fs import, no temp files) and the heartbeat; add the ladder-draft job per asyncapi.
- "AI on this phone" status screen (/ai/), honest: what runs where, what never leaves the phone, last tier used.
- Privacy guarantees doc (what never leaves the device), with tests that prove it (network capture during a typed condition shows no typed words).
- Performance report per device class (this Mac now; iPhone rows filled Sunday from the device check).
- AI runtime docs and the "measured, not shipped" record for the in-browser models (lab 01, 07, 09).

Done = every AI feature runs through some tier on every phone, and is measured.
