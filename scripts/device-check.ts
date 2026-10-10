// Sunday device check kit: one HTTPS address on the Mac for the four iPhones.
//   /check/              the ordered checklist (apps/web/static/check/index.html)
//   /check/capability/   capability page (imported from lab spike 04)
//   /check/compass.html  compass permission flow (spike E3)
//   /lab/fps/, /lab/haptics/  flame frame rate and haptics (prototype build)
//   POST /api/device-check   saves a phone's results to device-results/results.jsonl
// Usage: npm run device-check [-- local]   (default https on the LAN, self-signed)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(ROOT, "apps/web/static/check");
const PROTO = path.join(ROOT, "design/prototype/build");
const OUT = path.join(ROOT, "device-results");
const CERTS = path.join(ROOT, "node_modules/.cache/device-check");
const MODE = process.argv[2] === "local" ? "local" : "https";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

const lanIp = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === "IPv4" && !i.internal)?.address ?? "127.0.0.1";

function file(root: string, rel: string): string | null {
  let f = path.resolve(root, `.${rel}`);
  if (f !== root && !f.startsWith(root + path.sep)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(`${f}.html`)) f = `${f}.html`;
  return fs.existsSync(f) ? f : null;
}

function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const p = decodeURIComponent(url.pathname);
  if (req.method === "POST" && p === "/api/device-check") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      fs.mkdirSync(OUT, { recursive: true });
      fs.appendFileSync(
        path.join(OUT, "results.jsonl"),
        `${JSON.stringify({ at: new Date().toISOString(), ua: req.headers["user-agent"], body: safeJson(body) })}\n`,
      );
      console.log(
        `saved results from ${String(req.headers["user-agent"]).match(/iPhone OS [\d_]+|Mac OS X [\d_]+|Android [\d.]+/)?.[0] ?? "a device"}`,
      );
      res.writeHead(204).end();
    });
    return;
  }
  if (p === "/") {
    res.writeHead(302, { location: "/check/" }).end();
    return;
  }
  const f = p.startsWith("/check") ? file(CHECK, p.replace(/^\/check/, "") || "/") : file(PROTO, p);
  if (!f) {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[path.extname(f)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  fs.createReadStream(f).pipe(res);
}
const safeJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return { text: s.slice(0, 20_000) };
  }
};

if (!fs.existsSync(path.join(PROTO, "lab/fps.html")) && !fs.existsSync(path.join(PROTO, "lab/fps/index.html"))) {
  console.log("Building the prototype for /lab/fps and /lab/haptics (about a minute)...");
  execFileSync("npm", ["run", "build"], { cwd: path.join(ROOT, "design/prototype"), stdio: "inherit" });
}

const ip = lanIp();
if (MODE === "local") {
  http.createServer(handler).listen(8705, "127.0.0.1", () => console.log("Desktop test: http://127.0.0.1:8705/check/"));
} else {
  fs.mkdirSync(CERTS, { recursive: true });
  const cert = path.join(CERTS, `cert-${ip}.pem`);
  const key = path.join(CERTS, `key-${ip}.pem`);
  if (!fs.existsSync(cert)) {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "7",
        "-keyout",
        key,
        "-out",
        cert,
        "-subj",
        "/CN=flare-device-check",
        "-addext",
        `subjectAltName=IP:${ip},DNS:localhost`,
      ],
      { stdio: "ignore" },
    );
  }
  https
    .createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, handler)
    .listen(8443, "0.0.0.0", () => {
      console.log(`On each iPhone (same Wi-Fi, Wi-Fi Assist off), open:\n\n  https://${ip}:8443/check/\n`);
      console.log("Tap Show Details, then visit this website, to accept the certificate.");
      console.log(`Results land in ${path.relative(ROOT, OUT)}/results.jsonl. Ctrl-C to stop.`);
    });
}
