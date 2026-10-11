// Account-wide tokens must never sit in a slot meant for a narrow key, and must never be sent
// to the server's host (Render). Shape checks only; values are never printed.
export const ACCOUNT_TOKENS: { re: RegExp; what: string }[] = [
  { re: /^dop_v1_/, what: "a DigitalOcean personal access token (full account access)" },
  { re: /^doo_v1_/, what: "a DigitalOcean OAuth token" },
  { re: /^sntryu_/, what: "a Sentry user auth token" },
  { re: /^sntrys_/, what: "a Sentry organization auth token" },
  { re: /^gh[pousr]_/, what: "a GitHub token" },
  { re: /^rnd_/, what: "a Render API key" },
];

/** Names the kind of account token `v` is, or null when it looks like none of them. */
export function accountToken(v: string | undefined): string | null {
  if (!v) return null;
  return ACCOUNT_TOKENS.find((t) => t.re.test(v))?.what ?? null;
}
