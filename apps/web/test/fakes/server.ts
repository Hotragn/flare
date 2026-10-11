// Fake of the server's draft endpoints (openapi draftFromPhoto, draftLadder), for tier tests.
// Records every request so tests can check what left the phone.

export type FakeMode = "hub" | "rules" | "slow" | "drop" | "500" | "garbage" | "bad-draft";
export type Seen = { url: string; contentType: string | null; body: string | Blob | null };

export function fakeServer(mode: FakeMode, opts: { delayMs?: number } = {}) {
  const seen: Seen[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    seen.push({ url, contentType: headers.get("content-type"), body: (init?.body as string | Blob) ?? null });
    const signal = init?.signal;
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const id = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
          clearTimeout(id);
          reject(signal.reason ?? new DOMException("aborted", "AbortError"));
        });
      });
    if (mode === "drop") throw new TypeError("Load failed");
    if (mode === "slow") await wait(opts.delayMs ?? 60_000);
    else if (opts.delayMs) await wait(opts.delayMs);
    if (mode === "500") return new Response("{}", { status: 500 });
    if (mode === "garbage") return new Response("not json", { status: 200 });
    const ladder = url.endsWith("/ladder");
    const hub = mode === "hub" || mode === "slow" || mode === "bad-draft";
    const json = ladder
      ? {
          steps: [
            { step: 1, label: "Fairlane loop", minutes: 60 },
            { step: 2, label: "Pond walk", minutes: 30 },
            { step: 3, label: "Bench stop", minutes: 15 },
            { step: 4, label: "Porch sit", minutes: 10 },
          ],
          tier: hub ? "hub" : "rules",
          ms: 2900,
        }
      : mode === "bad-draft"
        ? {
            invite: "Smiling man by the pond",
            alt: "A man with a beard sits on a bench by the pond.",
            tier: "hub",
            ms: 3000,
          }
        : hub
          ? {
              invite: "Golden hour by the pond",
              alt: "A pond with a wooden bench and tall trees.",
              tier: "hub",
              ms: 3100,
            }
          : { invite: "Outside right now. Come?", alt: "", tier: "rules", ms: 4 };
    return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetch: fetchFn, seen };
}

export function memoryKV() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    dump: () => Object.fromEntries(m),
  };
}
