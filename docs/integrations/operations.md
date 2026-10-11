# Operations: deploy and webhook

All three scripts read `.env` (or `FLARE_ENV_FILE`) and print a dry run unless given `--yes`. None prints a value: the bot token and the webhook secret show as `<hidden>`, deploy env shows `set`, `missing` or `from Render`.

## Order on the day (each step waits for the founder's yes)

1. Device checklist step 0: the live Telegram test runs from `lab/` with polling (docs/engineering/05-device-checklist.md). Polling and a webhook can't both run, so the webhook comes after.
2. `npm run deploy:render`: read the plan. Then `npm run deploy:render -- --yes`.
3. Add `TELEGRAM_WEBHOOK_SECRET` (16 to 256 of `A-Z a-z 0-9 _ -`) and `TELEGRAM_ALLOWED_CHAT_IDS` (the "Flare test" chat id) to `.env`, and run step 2 again so the server has them.
4. `npm run telegram:webhook`: read the call. Then `npm run telegram:webhook -- --yes`.
5. `npm run telegram:status -- --yes`: expect the webhook URL, 0 pending updates, privacy mode on, no last error.

## `npm run deploy:render`

Find-or-create by name, so a second run updates instead of making duplicates.

| Step | Render API |
| --- | --- |
| Workspace | `GET /v1/owners` |
| Postgres `flare-db`, Ohio, version 17 | `GET /v1/postgres?name=`, else `POST /v1/postgres` |
| `DATABASE_URL` | `GET /v1/postgres/{id}/connection-info` (internal string) |
| Web service `flare-outside`: Node, starter, 1 instance, health `/api/v1/health`, build `npm ci && npm run build`, start `npm start`, auto-deploy off | `GET /v1/services?name=`, else `POST /v1/services` |
| `PUBLIC_BASE_URL` | the `.env` value if it is https; else the service's own `https://...onrender.com` URL |
| Env on the web service: `PUBLIC_BASE_URL`, `HUB_SECRET`, `TELEGRAM_*`, `VAPID_*` that are set, `DATABASE_URL`, `NODE_VERSION=24.21.0` | `PUT /v1/services/{id}/env-vars` |
| Cron `flare-sweep`: `*/5 * * * *`, `npm run sweep` | `POST /v1/services` (type `cron_job`), then its env |
| Deploy | `POST /v1/services/{id}/deploys` |

Needs `RENDER_KEY` and `HUB_SECRET`. The dry run makes no network call. Tested against a fake Render API (`deploy-render.test.ts`, 5 tests).

## `npm run telegram:webhook`

Calls `setWebhook` with `url={PUBLIC_BASE_URL}/api/v1/telegram/webhook`, `secret_token`, `allowed_updates=["message","callback_query","my_chat_member"]`, `drop_pending_updates=true` (contract section 1). Refuses with `--yes` when `PUBLIC_BASE_URL` is not https, the secret is missing or malformed, or the allow-list is empty. Run it after the deploy, with `PUBLIC_BASE_URL` set to the deployed https address.

## `npm run telegram:status`

Calls `getMe` and `getWebhookInfo` and prints the bot name, privacy mode, webhook URL, pending count and last error. Also behind `--yes`, since it calls Telegram.

Both Telegram scripts are also `npm run -w apps/server telegram:webhook` and `telegram:status`, as the contract names them.
