// Telegram bind link (PW6, telegram.md): the bot's personal link opens
// `/g/{id}/?via=tg&bind={token}#k=...`. The page joins as usual, then sends the token here
// so the Telegram yes and this phone's member count once (BR-ID-5).
import type { FlareOutbox } from "./index.ts";

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Reads `bind` from the address and removes it (and `via`) with replaceState, so a shared
 * or bookmarked link never carries the single-use token. The #k= fragment stays.
 */
export function takeBindToken(
  loc: Pick<Location, "href"> = globalThis.location,
  history: Pick<History, "replaceState" | "state"> | undefined = globalThis.history,
): string | null {
  const url = new URL(loc.href);
  const token = url.searchParams.get("bind");
  if (token === null) return null;
  url.searchParams.delete("bind");
  url.searchParams.delete("via");
  history?.replaceState(history.state, "", url.pathname + url.search + url.hash);
  return TOKEN.test(token) ? token : null;
}

/** POST /gatherings/{id}/telegram-bind through the outbox. Resolves the Me view or null if queued. */
export function bindTelegram<Me = unknown>(
  outbox: FlareOutbox,
  gatheringId: string,
  token: string,
): Promise<Me | null> {
  return outbox.send<Me>({ method: "POST", path: `/api/v1/gatherings/${gatheringId}/telegram-bind`, body: { token } });
}
