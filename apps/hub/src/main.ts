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

// Warm the model so the first friend doesn't wait for the 7 to 14 s cold load (report 02).
const t = performance.now();
await chat(ollama, null).catch(() => "");
console.info(`hub: model warm in ${Math.round(performance.now() - t)} ms`);
startHub({ serverUrl, secret: need("HUB_SECRET"), ollama, onLog: (e) => console.info(`hub: ${JSON.stringify(e)}`) });
