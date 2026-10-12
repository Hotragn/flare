// Bot strings come from the copy deck (ICD-12), never from code. Loaded once at start;
// a missing key stops the server at boot instead of posting a blank line in a chat.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DECK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../design/prototype/src/lib/copy/deck.json",
);

export const BOT_KEYS = [
  "bot.start.hello",
  "bot.start.what",
  "bot.start.next",
  "bot.help",
  "bot.post.need",
  "bot.post.until",
  "bot.post.open",
  "bot.post.ember",
  "bot.post.smaller",
  "bot.cb.yes",
  "bot.cb.yesNoChat",
  "bot.cb.already",
  "bot.cb.closed",
  "bot.dm.yes",
  "bot.dm.yes2",
  "bot.dm.link",
  "bot.dm.nothingOpen",
  "bot.refuse.dm",
  "bot.plan.step",
  "invite.yes",
  "invite.condition",
  "lit.notice",
  "lit.find",
  "gone.title",
  "outside.thanks",
  "push.ember",
  "push.planOn",
  "need.more",
  "need.lit",
  "app.name",
] as const;
export type BotKey = (typeof BOT_KEYS)[number];

type Deck = { strings?: Record<string, { text: string }> } & Record<string, unknown>;

function load(): Record<BotKey, string> {
  const deck = JSON.parse(fs.readFileSync(DECK, "utf8")) as Deck;
  const table = (deck.strings ?? deck) as Record<string, { text?: string }>;
  const out = {} as Record<BotKey, string>;
  for (const k of BOT_KEYS) {
    const t = table[k]?.text;
    if (typeof t !== "string") throw new Error(`copy deck is missing ${k}`);
    out[k] = t;
  }
  return out;
}

const STRINGS = load();

/** The deck string for `key` with `{name}` slots filled. Unknown slots stay visible in tests. */
export function t(key: BotKey, vars: Record<string, string | number> = {}): string {
  return STRINGS[key]
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
    .replace(/\b(is|are|meet|be) at [Nn]ear\b/g, "$1 near"); // "is near Heather Drive", not "is at Near"
}
