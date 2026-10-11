// Loads .env (if present) and reads typed config. Never logs values.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const file = process.env.FLARE_ENV_FILE ?? path.join(ROOT, ".env");
if (fs.existsSync(file)) process.loadEnvFile(file);

const str = (k: string, d = "") => process.env[k] ?? d;
export const env = {
  port: Number(str("PORT", "8787")),
  publicBaseUrl: str("PUBLIC_BASE_URL", "http://localhost:8787"),
  databaseUrl: str("DATABASE_URL"),
  hubSecret: str("HUB_SECRET"),
  webBuildDir: str("WEB_BUILD_DIR", path.join(ROOT, "apps/web/build")),
  version: str("RENDER_GIT_COMMIT", "dev").slice(0, 12),
  hubJobTimeoutMs: Number(str("HUB_JOB_TIMEOUT_MS", "6000")), // BR-AI-1: hub tier 6 s
  hubPingMs: Number(str("HUB_PING_MS", "5000")), // silent hub dropped after 2.5 pings (spike E1)
  ladderTimeoutMs: Number(str("HUB_LADDER_TIMEOUT_MS", "8000")), // ADR-0007: ladder 8 s
  ladderAgent: str("LADDER_AGENT") === "1", // ADR-0025: the Mastra Plan agent, off by default
  vapidPublicKey: str("VAPID_PUBLIC_KEY") || null, // public by design; served by /config
  telegramBotUsername: str("TELEGRAM_BOT_USERNAME") || null,
};
