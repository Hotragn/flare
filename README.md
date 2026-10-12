# Flare

> **Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 1 (Touch Grass).**
> **Started Oct 10, 2026:** the first commit is `27d4856` at 13:01 ET, inside the Oct 5 to 11 window.
> **Submission deadline:** Oct 11, 11:59 PM PDT (Oct 12, 06:59 UTC).
>
> **Changes after the deadline** (every commit after Oct 12, 06:59 UTC; nothing on the live site changed unless a line says so):
>
> - `ad59cc9`, Oct 12 07:09 UTC: privacy, docs and tests only. A real street name in code comments, one test and the field notes is now a neutral example ("Maple Road"). The OpenStreetMap pack in apps/web/static/maps is public map data and is unchanged.
> - This commit, Oct 12 about 07:15 UTC: README only. This block.

Snap where you are. If enough friends quietly say yes, it's on.

Flare is an installable web app for small groups of friends (2 to 12). A host sends a photo of where they are, or a Plan for later. Friends say yes in private, with conditions if they like ("after 2", "only with Amor"). It lights only when enough people can come, it shrinks to a smaller plan instead of failing, it works for friends with low vision or limited mobility and with no signal, and it deletes itself within 5 minutes of ending.

Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 1 "Touch Grass". Tested on the real stack end to end, on two iPhones (16 Pro Max, 13) and in a 48-friend simulation; one short meetup in person so far (field test 2).

**Using Flare needs nothing.** Open https://flare-outside.onrender.com/app/ (or the [demo](https://flare-outside.onrender.com/app/demo/)) and send the link to friends. Gemma runs on our laptop for everyone. The rest of this page is only for hosting your own copy.

## Host your own copy

You need Node 24.21.0 or later ([.nvmrc](.nvmrc)). A model is optional. Pick one of three levels:

1. **No AI keys.** Everything works. The host writes the six words, with place-word chips from the map, and the rules engine does the rest. (`npm run e2e:no-keys` checks this: a Flare sent from typed words lights, and Plans get the template steps.)
2. **A free Google AI Studio key.** Put `GEMINI_API_KEY=` in `.env` (a key from [aistudio.google.com](https://aistudio.google.com)). Gemma 4 runs in the cloud, with no GPU and no laptop. Plan drafts use it automatically, and a photo goes there only when the host taps **Ask cloud Gemma** for that Flare. Google's free tier may review what it receives. (`npm run e2e:cloud-only` checks this: Gemma's words for a photo in about 3.4 s, a Plan draft in 1.3 s.)
3. **Ollama on your own machine.** The private option: the photo never leaves your machine. Start the hub (step 2 below) on a Mac or any machine with a GPU.

`DATABASE_URL=pglite:memory` gives an in-memory Postgres for a quick run.

**1. The server and the app**

```bash
git clone https://github.com/Hotragn/flare && cd flare
npm ci
cp .env.example .env        # set HUB_SECRET to any 32+ random characters
npm run check-env           # lists every setting as set, missing or default; never prints values
npm run build && npm start  # server and web app on http://localhost:8787
```

Set `DATABASE_URL=pglite:memory` in `.env` for a quick local run (an in-memory Postgres, wiped on restart), or `postgres://…` for a real one. With it empty the server starts, but Flares can't be saved.

**2. The AI hub, for level 3 only** (second terminal, on the machine with Ollama)

```bash
ollama pull gemma4:e4b-it-q4_K_M
npm run hub
```

The hub dials out to the server over a WebSocket, so nothing on that machine is exposed. Check it at http://localhost:8787/hello/: pick a photo, and six words come back in about 3.5 s. `npm run e2e:hello` does the same in headless Chrome.

**3. A phone**

Open `http://localhost:8787/app/` in Chrome on the same computer, or on a phone at `http://<your-computer's-IP>:8787/app/` (set `PUBLIC_BASE_URL` to that address so links work). iPhones only allow the live camera on HTTPS, so on plain HTTP tap **Pick a photo** instead. For the full phone experience (camera, compass, install, notifications), deploy it: [deploy runbook](docs/engineering/06-deploy-runbook.md).

### Optional settings

`npm run check-env -- server hub bot` shows each one. Each feature is off when its settings are empty:

| Feature | Settings | Docs |
| --- | --- | --- |
| Lit and Ember notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | [push](docs/integrations/push.md) |
| Telegram groups | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ALLOWED_CHAT_IDS`, `TELEGRAM_WEBHOOK_SECRET` | [Telegram contract](docs/architecture/contracts/telegram.md), [ADR-0023](docs/architecture/adr/0023-telegram-card-and-photo-opt-in.md) |
| Cloud fallback when the hub is off | `DO_MODEL_ACCESS_KEY` (a scoped model key, not an account token) | [ADR-0022](docs/architecture/adr/0022-digitalocean-cloud-tier.md) |
| AI tracing | `SENTRY_DSN` (a project DSN, not an auth token) | [ADR-0021](docs/architecture/adr/0021-sentry-agent-tracing.md) |

`check-env` refuses account-wide tokens in these fields, and the deploy script never sends them.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run ci` | Secret scan, lint, types, tests, contract checks, build, JS budget. Same as GitHub Actions |
| `npm test` | Vitest, all workspaces |
| `npm run contracts` | Lints [openapi.yaml](docs/architecture/contracts/openapi.yaml), parses [asyncapi.yaml](docs/architecture/contracts/asyncapi.yaml), checks the server's routes against them |
| `npm run e2e:hello` | Phone page, server, hub relay, Ollama and back, in headless Chrome |
| `npm run e2e:field`, `e2e:sparks`, `e2e:loop`, `e2e:telegram`, `e2e:pwa` | The field-test paths on the real server and engine, in Chrome |
| `npm run eval -- <task>` | Model evals (photo, ladder, conditions, rest-loop, osm-tags); reports in [evals/reports](evals/reports) |
| `npm run device-check` | The HTTPS kit for checking real iPhones ([checklist](docs/engineering/05-device-checklist.md)) |
| `npm run check-env [-- server hub bot]` | Which settings are set or missing, per app |
| `npm run hooks` | Installs the pre-push gate: secret scan, session scan, lint, types, tests (about 26 s) |

## Layout

| Path | Contents |
| --- | --- |
| [apps/server](apps/server) | Hono HTTP API, hub relay WebSocket, Postgres schema |
| [apps/hub](apps/hub) | Runs next to Ollama, dials out to the server, drafts six words from a photo in memory |
| [apps/web](apps/web) | SvelteKit app: the phone app and the link page |
| [packages/shared](packages/shared) | Code both sides use: photo prompt and `enforce()`, short codes, plain-text SMS forms, hub protocol |
| [packages/engine](packages/engine) | The core engine: quorum, conditions, Ember, the smaller plan |
| [evals](evals) | Datasets, the eval runner and reports for every model task |
| [docs/](docs) | Everything else, indexed in [docs/README.md](docs/README.md) |
| [design/prototype](design/prototype) | Clickable prototype of all 33 screens |

## Privacy in one paragraph

The group key lives in the link's `#fragment`, which browsers never send to servers. Photos, names, places, coordinates and Sparks are sealed on the phone (AES-256-GCM) before upload. Conditions are parsed on the phone and only the rule is sent. To write the six words the photo goes to our laptop over an encrypted link and is held in memory only. Groups that choose Telegram trade some of this for convenience, and the app says so before they do. Full details: [security and privacy design](docs/architecture/08-security-privacy.md).

## License

[AGPL-3.0-or-later](LICENSE). Map data © OpenStreetMap contributors, ODbL. Model: Gemma 4 (Gemma terms of use).

