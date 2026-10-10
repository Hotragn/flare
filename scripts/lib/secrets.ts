// Secret patterns for the pre-push and CI scan (SRS-SEC-2). Findings name the file, line
// and rule, never the matched text.
export type Finding = { file: string; line: number; rule: string };

export const RULES: { rule: string; re: RegExp }[] = [
  { rule: "telegram-bot-token", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { rule: "mongodb-uri-with-password", re: /mongodb(\+srv)?:\/\/[^:\s/]+:[^@\s]+@/ },
  { rule: "postgres-uri-with-password", re: /postgres(ql)?:\/\/[^:\s/]+:[^@\s]+@/ },
  { rule: "render-api-key", re: /\brnd_[A-Za-z0-9]{20,}\b/ },
  { rule: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { rule: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
];

/** Scans text for rule matches and for any of the given known secret values. */
export function scan(file: string, text: string, known: { key: string; value: string }[] = []): Finding[] {
  const out: Finding[] = [];
  const lines = text.split("\n");
  lines.forEach((l, i) => {
    for (const { rule, re } of RULES) if (re.test(l)) out.push({ file, line: i + 1, rule });
    for (const k of known)
      if (k.value.length >= 12 && l.includes(k.value)) out.push({ file, line: i + 1, rule: `value-of-${k.key}` });
  });
  return out;
}
