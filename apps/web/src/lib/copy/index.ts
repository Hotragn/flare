// Flare copy deck loader. One source for every user-facing string.
//   t("need.more", { n: 2 })            -> "Need 2 more."
//   t("hot.met", { n: 1 })              -> "Met here once"   (uses the entry's "one" form when n === 1)
//   variant("privacy.coords")           -> "A" or "B" (see deck meta.variants)
// Keys are typed from deck.json, so a wrong key fails `npm run check`.
// A missing template variable throws, so it shows up in the exports instead of on a phone.
// One deck for the whole repo (ICD-12): read straight from design/prototype, never copied.
import deck from "../../../../../design/prototype/src/lib/copy/deck.json";

export type CopyKey = keyof typeof deck.strings;
export type Vars = Record<string, string | number>;
type Entry = { text: string; one?: string; kind: string };

const strings = deck.strings as Record<CopyKey, Entry>;

/** #lib/copy/site.ts adds the website's lines, which the app bundle leaves out (vite.config.ts). */
export function addStrings(more: Record<string, Entry>): void {
  Object.assign(strings, more);
}

export function t(key: CopyKey, vars: Vars = {}): string {
  const entry = strings[key];
  if (!entry) throw new Error(`copy: unknown key "${key}"`);
  const template = vars.n === 1 && entry.one ? entry.one : entry.text;
  return nearSpot(
    template.replace(/\{(\w+)\}/g, (_, name: string) => {
      if (!(name in vars)) throw new Error(`copy: "${key}" needs {${name}}`);
      return String(vars[name]);
    }),
  );
}

/** Live bug (Oct 11): a "Near Heather Drive" spot reads "is near Heather Drive", not "is at Near". */
export const nearSpot = (s: string): string => s.replace(/\bat [Nn]ear (?=\p{Lu})/gu, "near ");

/** Joins two or more strings with the deck's middle-dot separator. */
export const dot = (...parts: string[]) => parts.filter(Boolean).join(strings["app.dot"].text);

export type VariantName = keyof typeof deck.meta.variants;
export const variant = (name: VariantName): string => deck.meta.variants[name];

/** Read-back sentence from rule fragments: "Got it: only with Amor, back by 5 PM. Right?" */
export const readback = (fragments: string[]) => t("readback.line", { rules: fragments.join(", ") });
