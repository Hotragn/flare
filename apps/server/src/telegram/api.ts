// Telegram Bot API client (contracts/telegram.md). Small on purpose: the methods the bot
// uses, JSON for most calls and multipart for sendPhoto from memory. The base URL is
// configurable so tests point it at a fake Bot API; the token never appears in errors or logs.

export type InlineButton = { text: string; callback_data?: string; url?: string };
export type Keyboard = { inline_keyboard: InlineButton[][] };
export type SentMessage = { message_id: number; chat: { id: number } };

/** A Bot API error with the HTTP code and Telegram's description. Never holds the token. */
export class BotApiError extends Error {
  readonly code: number;
  readonly description: string;
  readonly retryAfter: number | null;
  constructor(method: string, code: number, description: string, retryAfter: number | null) {
    super(`${method} failed: ${code}`);
    this.code = code;
    this.description = description;
    this.retryAfter = retryAfter;
  }
  /** "message is not modified" (400) is harmless for edits (contract section 5). */
  get notModified(): boolean {
    return this.code === 400 && /message is not modified/i.test(this.description);
  }
  /** The user never opened a private chat with the bot, or blocked it. */
  get cannotMessageUser(): boolean {
    return this.code === 403 || (this.code === 400 && /chat not found/i.test(this.description));
  }
}

export interface BotApi {
  call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
  sendPhoto(chatId: number, photo: Buffer, caption: string, keyboard?: Keyboard, mime?: Mime): Promise<SentMessage>;
  /** Replaces a photo post's image and caption (editMessageMedia), for the branded card. */
  editPhoto(
    chatId: number,
    messageId: number,
    photo: Buffer,
    caption: string,
    keyboard: Keyboard,
    mime?: Mime,
  ): Promise<unknown>;
}

export type Mime = "image/jpeg" | "image/png";
const fileName = (mime: Mime) => (mime === "image/png" ? "flare.png" : "flare.jpg");

export type BotApiOptions = { token: string; baseUrl?: string; timeoutMs?: number };

export function createBotApi({
  token,
  baseUrl = "https://api.telegram.org",
  timeoutMs = 10_000,
}: BotApiOptions): BotApi {
  const root = `${baseUrl.replace(/\/$/, "")}/bot${token}`;

  async function send<T>(method: string, body: BodyInit, headers: Record<string, string>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${root}/${method}`, {
        method: "POST",
        body,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // The fetch error text can carry the URL, and the URL carries the token.
      throw new BotApiError(method, 0, "network error", null);
    }
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: T;
      description?: string;
      parameters?: { retry_after?: number };
    } | null;
    if (!res.ok || !json?.ok)
      throw new BotApiError(
        method,
        res.status,
        String(json?.description ?? "no description"),
        json?.parameters?.retry_after ?? null,
      );
    return json.result as T;
  }

  return {
    call: (method, params) => send(method, JSON.stringify(params), { "content-type": "application/json" }),
    sendPhoto(chatId, photo, caption, keyboard, mime = "image/jpeg") {
      const form = new FormData();
      form.set("chat_id", String(chatId));
      form.set("caption", caption);
      if (keyboard) form.set("reply_markup", JSON.stringify(keyboard));
      form.set("photo", new Blob([new Uint8Array(photo)], { type: mime }), fileName(mime));
      return send<SentMessage>("sendPhoto", form, {});
    },
    editPhoto(chatId, messageId, photo, caption, keyboard, mime = "image/png") {
      const form = new FormData();
      form.set("chat_id", String(chatId));
      form.set("message_id", String(messageId));
      form.set("media", JSON.stringify({ type: "photo", media: "attach://card", caption }));
      form.set("reply_markup", JSON.stringify(keyboard));
      form.set("card", new Blob([new Uint8Array(photo)], { type: mime }), fileName(mime));
      return send("editMessageMedia", form, {});
    },
  };
}
