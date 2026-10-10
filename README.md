# Flare

Snap where you are. If enough friends quietly say yes, it's on.

Flare is an installable web app for small groups of friends (2 to 12). A host sends a photo of where they are, or a Plan for later. Friends say yes in private, with conditions if they like ("after 2", "only with Amor"). It lights only when enough people can come, it shrinks to a smaller plan instead of failing, it works for friends with low vision or limited mobility and with no signal, and it deletes itself within 5 minutes of ending.

Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 1 "Touch Grass". Field test: Sunday 2026-10-11, near Fairlane Town Center, Dearborn MI, on four iPhones.

## Run it yourself

Needs Node 24.21.0 or later ([.nvmrc](.nvmrc)), and for the photo AI a Mac (or any machine with a GPU) running [Ollama](https://ollama.com).

```bash
git clone https://github.com/Hotragn/flare-outside && cd flare-outside
npm ci
cp .env.example .env        # then fill in HUB_SECRET (any 32+ random characters)
npm run check-env           # reports set or missing, never values
npm run build && npm start  # server and web app on http://localhost:8787
```

The AI hub, in a second terminal on the machine with Ollama:

```bash
ollama pull gemma4:e4b-it-q4_K_M
npm run hub
```

Then open http://localhost:8787/hello/, pick a photo, and six words come back from the model in about 3.5 s. `npm run e2e:hello` does the same with Chrome and checks the answer.

Postgres is optional for local runs (`DATABASE_URL`); tests use an in-memory Postgres (PGlite).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run ci` | Secret scan, lint, types, tests, contract checks, build, JS budget. Same as GitHub Actions |
| `npm test` | Vitest, all workspaces |
| `npm run contracts` | Lints [openapi.yaml](docs/architecture/contracts/openapi.yaml), parses [asyncapi.yaml](docs/architecture/contracts/asyncapi.yaml), checks the server's routes against them |
| `npm run e2e:hello` | Phone page, server, hub relay, Ollama and back, in headless Chrome |
| `npm run check-env [-- server hub bot]` | Which settings are set or missing, per app |
| `npm run hooks` | Installs the pre-push secret scan |

## Layout

| Path | Contents |
| --- | --- |
| [apps/server](apps/server) | Hono HTTP API, hub relay WebSocket, Postgres schema |
| [apps/hub](apps/hub) | Runs next to Ollama, dials out to the server, drafts six words from a photo in memory |
| [apps/web](apps/web) | SvelteKit app: the phone app and the link page |
| [packages/shared](packages/shared) | Code both sides use: photo prompt and `enforce()`, short codes, plain-text SMS forms, hub protocol |
| [docs/](docs) | Research, product, requirements, brand, design, content, [architecture](docs/architecture/README.md), handoffs |
| [design/prototype](design/prototype) | Clickable prototype of all 33 screens |

## Privacy in one paragraph

The group key lives in the link's `#fragment`, which browsers never send to servers. Photos, names, places, coordinates and Sparks are sealed on the phone (AES-256-GCM) before upload. Conditions are parsed on the phone and only the rule is sent. To write the six words the photo goes to our laptop over an encrypted link and is held in memory only. Groups that choose Telegram trade some of this for convenience, and the app says so before they do. Full details: [security and privacy design](docs/architecture/08-security-privacy.md).

## License

[AGPL-3.0-or-later](LICENSE). Map data © OpenStreetMap contributors, ODbL. Model: Gemma 4 (Gemma terms of use).

## Changes after the DEV deadline

None yet. Any commit after Mon 2026-10-12 06:59 UTC will be listed here (SRS-MNT-2).
