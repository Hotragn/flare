// Copy deck lookup for the AI and conditions modules (ICD-12). Every user-facing string comes
// from design/prototype/src/lib/copy/deck.json; a missing key or variable throws, so a bad
// string fails a test instead of reaching a phone.
import deck from "../../../../../design/prototype/src/lib/copy/deck.json" with { type: "json" };

type Entry = { text: string; one?: string };
const strings = deck.strings as unknown as Record<string, Entry | undefined>;

export type Vars = Record<string, string | number>;

export function t(key: string, vars: Vars = {}): string {
  const entry = strings[key];
  if (!entry) throw new Error(`copy: unknown key "${key}"`);
  const template = vars.n === 1 && entry.one ? entry.one : entry.text;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!(name in vars)) throw new Error(`copy: "${key}" needs {${name}}`);
    return String(vars[name]);
  });
}

export const hasKey = (key: string): boolean => strings[key] !== undefined;
