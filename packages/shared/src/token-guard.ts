// Account-wide tokens must never sit in a slot meant for a narrow key, and must never be sent
// to the server's host (Render). Shape checks only; values are never printed.
export const ACCOUNT_TOKENS: { re: RegExp; what: string }[] = [
  { re: /^dop_v1_/, what: "a DigitalOcean personal access token (full account access)" },
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

/**
 * DigitalOcean model access keys and OAuth tokens share the `doo_v1_` prefix (2026-10-11: the
 * founder's scoped "flare-server" model key starts with it), so the prefix cannot tell them
 * apart. Behavior can: a model access key is refused by the account API. ADR-0022.
 */
export async function doKeyIsScoped(key: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!key || /^dop_v1_/.test(key)) return false;
  try {
    const r = await fetchImpl("https://api.digitalocean.com/v2/account", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    return r.status === 401 || r.status === 403;
  } catch {
    return false; // unknown: treat as not proven scoped
  }
}
