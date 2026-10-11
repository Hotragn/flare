// SRS-CH-7, ADR-0017: what iMessage, WhatsApp and Telegram crawlers read from a /g/{id} link.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CARD_PATH, injectTags, mountPreview, previewTags } from "../../src/preview/index.ts";

const GID = "3f0b5a52-8d2e-4c1a-9b7e-0f6c2d4a1e55";
const GONE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://flare-outside.onrender.com";
// The user agents each service's link fetcher sends (checked 2026-10-10).
const CRAWLERS = {
  iMessage:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
  WhatsApp: "WhatsApp/2.24.21.80 i",
  Telegram: "TelegramBot (like TwitterBot)",
};

let dir: string;
let app: Hono;
const SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Flare</title>
<meta property="og:title" content="Flare site"><meta name="description" content="site">
<link rel="modulepreload" href="/_app/a.js">${"<!-- padding -->".repeat(2000)}
</head><body><div id="app"></div><script>__sveltekit_x = {base: ""};</script></body></html>`;

beforeAll(() => {
  // Not in os.tmpdir(): the hub test watches that folder to prove the hub writes no files (BUG-027).
  const cache = path.resolve(import.meta.dirname, "../../../../node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  dir = fs.mkdtempSync(path.join(cache, "flare-preview-"));
  fs.writeFileSync(path.join(dir, "200.html"), SHELL);
  app = new Hono();
  mountPreview(app, {
    publicBaseUrl: ORIGIN,
    webBuildDir: dir,
    need: async (id) => (id === GID ? 2 : null),
  });
  app.get("*", (c) => c.text("fallback", 404));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const meta = (html: string, key: string) =>
  new RegExp(`<meta (?:property|name)="${key.replace(/[:]/g, "\\:")}" content="([^"]*)">`).exec(html)?.[1];

/** Width and height from a JPEG's SOF0/SOF2 marker. */
function jpegSize(b: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < b.length) {
    const marker = b[i + 1] as number;
    const len = b.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("no SOF");
}

describe("link previews (ADR-0017, SRS-CH-7)", () => {
  for (const [name, ua] of Object.entries(CRAWLERS))
    it(`SRS-CH-7: ${name}'s crawler reads the brand card, the fixed title and the count`, async () => {
      const res = await app.request(`/g/${GID}`, { headers: { "user-agent": ua } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      const html = await res.text();
      // Tags sit in the first 4 KB even with a 30 KB shell (WhatsApp reads only the start).
      const head = html.slice(0, 4096);
      expect(meta(head, "og:title")).toBe("A Flare from a friend");
      expect(meta(head, "og:description")).toBe("Need 2 more. Open it to say yes in private.");
      expect(meta(head, "og:image")).toBe(`${ORIGIN}${CARD_PATH}`);
      expect(meta(head, "og:image:width")).toBe("1200");
      expect(meta(head, "og:image:height")).toBe("630");
      expect(meta(head, "og:image:type")).toBe("image/jpeg");
      expect(meta(head, "og:url")).toBe(`${ORIGIN}/g/${GID}`);
      expect(meta(head, "twitter:card")).toBe("summary_large_image");
      // Title under 60 and description under 155 characters: neither service truncates them.
      expect((meta(head, "og:title") ?? "").length).toBeLessThan(60);
      expect((meta(head, "og:description") ?? "").length).toBeLessThan(155);
    });

  it("the shell's own site tags are replaced, not duplicated", async () => {
    const html = await (await app.request(`/g/${GID}`)).text();
    expect(html.match(/og:title/g)).toHaveLength(1);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).not.toContain("Flare site");
    expect(html).toContain('<div id="app"></div>');
  });
  it("the CSP allows the shell's inline bootstrap by hash", async () => {
    const res = await app.request(`/g/${GID}/`);
    expect(res.headers.get("content-security-policy")).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });
  it("a Gone or unknown gathering shows the title only: no count", async () => {
    const html = await (await app.request(`/g/${GONE}`)).text();
    expect(meta(html, "og:title")).toBe("A Flare from a friend");
    expect(meta(html, "og:description")).toBeUndefined();
  });
  it("non-UUID paths fall through to the SPA server", async () => {
    expect(await (await app.request("/g/not-an-id")).text()).toBe("fallback");
  });
  it("HEAD works for crawlers that check first", async () => {
    const res = await app.request(`/g/${GID}`, { method: "HEAD" });
    expect(res.status).toBe(200);
  });
  it("the card is a 1200 x 630 JPEG under WhatsApp's 300 KB limit", async () => {
    const res = await app.request(CARD_PATH, { headers: { "user-agent": CRAWLERS.WhatsApp } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const b = Buffer.from(await res.arrayBuffer());
    expect(b.length).toBeLessThan(300_000);
    expect(Number(res.headers.get("content-length"))).toBe(b.length);
    expect(jpegSize(b)).toEqual({ width: 1200, height: 630 });
  });
  it("ADR-0017: tags carry nothing but the fixed copy and a count", () => {
    const tags = previewTags(ORIGIN, GID, 3);
    const contents = [...tags.matchAll(/content="([^"]*)"/g)].map((m) => m[1]);
    for (const c of contents)
      expect(
        [
          "website",
          "Flare",
          "A Flare from a friend",
          "Need 3 more. Open it to say yes in private.",
          "summary_large_image",
          "noindex",
          "1200",
          "630",
          "image/jpeg",
        ].includes(c as string) || (c as string).startsWith(ORIGIN),
      ).toBe(true);
  });
  it("escapes values and works on a shell with no head", () => {
    const out = injectTags("<p>x</p>", previewTags('https://x.test/"><script>', GID, 1));
    expect(out).not.toContain('"><script>');
    expect(out.startsWith("<!doctype html><html><head><title>")).toBe(true);
  });
});
