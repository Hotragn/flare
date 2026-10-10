// Hub entry: run on the Mac next to Ollama. `npm run hub`
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startHub } from "./client.ts";
import { chat } from "./ollama.ts";

const envFile =
  process.env.FLARE_ENV_FILE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
try {
  process.loadEnvFile(envFile);
} catch {
  /* no .env: use the process environment */
}

const need = (k: string) => {
  const v = process.env[k];
  if (!v) {
    console.error(`missing ${k} (run npm run check-env)`);
    process.exit(1);
  }
  return v;
};
const ollama = {
  url: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL ?? "gemma4:e4b-it-q4_K_M",
  timeoutMs: 30_000,
};
const serverUrl = process.env.FLARE_SERVER_URL ?? "ws://localhost:8787";

// Warm the model so the first friend doesn't wait for the 7 to 14 s cold load (report 02),
// and again every 20 min so Ollama's 30 min keep_alive never unloads it mid-test. The server
// gives the hub 6 s per photo (BR-AI-1), so a cold load would always fall to the template.
const warm = async () => {
  const t = performance.now();
  await chat(ollama, null).catch(() => "");
  console.info(`hub: model warm in ${Math.round(performance.now() - t)} ms`);
};
await warm();
setInterval(warm, 20 * 60_000).unref();
startHub({
  serverUrl,
  secret: need("HUB_SECRET"),
  ollama,
  silenceMs: Number(process.env.HUB_SILENCE_MS ?? 15_000),
  onLog: (e) => console.info(`hub: ${JSON.stringify(e)}`),
});
