// mountPreview(app, deps): safe link previews for /g/{id} (ADR-0017, SRS-CH-7).
// Telegram fetches the link on its own servers; iMessage and WhatsApp build the preview on the
// sender's phone. Either way the preview then sits in the chat, where our deletion can't reach.
// So the tags carry only the brand card, a fixed title and the count: no photo, no words, no
// place, no host.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Hono } from "hono";
import { csp, inlineScriptHashes } from "../app.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DECK = path.resolve(HERE, "../../../../design/prototype/src/lib/copy/deck.json");
/** The brand OG card as an 85-quality JPEG (93 KB): under WhatsApp's 300 KB preview limit. */
export const CARD_FILE = path.join(HERE, "og-card-1200x630.jpg");
export const CARD_PATH = "/og/flare-card-1200x630.jpg";
export const CARD = { width: 1200, height: 630, type: "image/jpeg" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PreviewDeps = {
  /** People still needed, or null when the gathering is unknown or Gone (BE: engine view). */
  need(gatheringId: string): Promise<number | null>;
  /** Absolute origin used in og:url and og:image, e.g. https://flare-outside.onrender.com */
  publicBaseUrl: string;
  /** SvelteKit build with 200.html, the SPA shell (url-map.md). */
  webBuildDir?: string;
};

function deckText(key: string): string {
  const deck = JSON.parse(fs.readFileSync(DECK, "utf8")) as { strings: Record<string, { text: string }> };
  const v = deck.strings[key]?.text;
  if (!v) throw new Error(`copy deck is missing ${key}`);
  return v;
}
const TITLE = deckText("og.link.safe.title");
const DESC = deckText("og.link.safe.desc");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** The tags for one gathering. `need` null: title only, so a Gone link says nothing more. */
export function previewTags(origin: string, gatheringId: string, need: number | null): string {
  const base = origin.replace(/\/$/, "");
  const desc = need === null ? null : DESC.replace("{n}", String(Math.max(1, need)));
  const image = `${base}${CARD_PATH}`;
  const tags: [string, string, string][] = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", "Flare"],
    ["property", "og:title", TITLE],
    ["property", "og:url", `${base}/g/${gatheringId}`],
    ["property", "og:image", image],
    ["property", "og:image:secure_url", image],
    ["property", "og:image:type", CARD.type],
    ["property", "og:image:width", String(CARD.width)],
    ["property", "og:image:height", String(CARD.height)],
    ["property", "og:image:alt", "Flare"],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", TITLE],
    ["name", "twitter:image", image],
  ];
  if (desc)
    tags.push(
      ["property", "og:description", desc],
      ["name", "twitter:description", desc],
      ["name", "description", desc],
    );
  return [
    `<title>${esc(TITLE)}</title>`,
    ...tags.map(([attr, k, v]) => `<meta ${attr}="${k}" content="${esc(v)}">`),
    '<meta name="robots" content="noindex">',
  ].join("\n");
}

/** Puts the tags right after <head> (crawlers read the start) and drops the shell's own. */
export function injectTags(shell: string, tags: string): string {
  const cleaned = shell
    .replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description|robots)"[^>]*>\s*/gi, "")
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "");
  const m = /<head[^>]*>/i.exec(cleaned);
  if (!m) return `<!doctype html><html><head>${tags}</head><body>${cleaned}</body></html>`;
  const at = m.index + m[0].length;
  return `${cleaned.slice(0, at)}\n${tags}\n${cleaned.slice(at)}`;
}

/** Used when the web build is absent (server tests, API-only runs). No script at all. */
const BARE_SHELL =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><p>Open this link on your phone to see the Flare.</p></body></html>';

export function mountPreview(app: Hono, deps: PreviewDeps): void {
  const card = fs.readFileSync(CARD_FILE);
  let shell: { html: string; mtime: number } | null = null;
  const readShell = (): string => {
    const file = deps.webBuildDir ? path.join(deps.webBuildDir, "200.html") : null;
    if (!file || !fs.existsSync(file)) return BARE_SHELL;
    const mtime = fs.statSync(file).mtimeMs;
    if (!shell || shell.mtime !== mtime) shell = { html: fs.readFileSync(file, "utf8"), mtime };
    return shell.html;
  };

  app.get(CARD_PATH, (c) =>
    c.body(new Uint8Array(card), 200, {
      "content-type": CARD.type,
      "content-length": String(card.length),
      "cache-control": "public, max-age=86400",
    }),
  );

  const page = async (id: string) => {
    const html = injectTags(readShell(), previewTags(deps.publicBaseUrl, id, await deps.need(id)));
    return {
      html,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Crawlers and phones must not reuse a stale count.
        "cache-control": "no-cache",
        "content-security-policy": csp(inlineScriptHashes(html)),
      },
    };
  };

  for (const route of ["/g/:id", "/g/:id/"])
    app.get(route, async (c, next) => {
      const id = c.req.param("id") ?? "";
      if (!UUID.test(id)) return next();
      const { html, headers } = await page(id);
      return c.body(html, 200, headers);
    });
}
