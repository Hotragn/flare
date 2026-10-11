// Fake Telegram Bot API (ICD-10): a node:http server that records every call and answers
// like Telegram does. Tests set failures per method to check retries and error handling.
import http from "node:http";
import type { AddressInfo } from "node:net";

export type Call = { method: string; params: Record<string, unknown>; photoBytes?: number };
type Failure = { code: number; description: string; times: number };

export async function startFakeBotApi() {
  const calls: Call[] = [];
  const failures = new Map<string, Failure>();
  /** Private chats the bot may message (users who pressed Start). */
  const startedUsers = new Set<number>();
  let nextMessageId = 100;

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks);
    const method = (req.url ?? "").split("/").pop() ?? "";
    let params: Record<string, unknown> = {};
    let photoBytes: number | undefined;
    const type = req.headers["content-type"] ?? "";
    if (type.startsWith("application/json")) params = JSON.parse(raw.toString("utf8"));
    else if (type.startsWith("multipart/form-data")) {
      const form = await new Response(raw, { headers: { "content-type": type } }).formData();
      for (const [k, v] of form.entries()) {
        // multipart turns \n into \r\n on the wire (WHATWG form data); Telegram shows both as a line break.
        if (typeof v === "string") params[k] = k === "reply_markup" ? JSON.parse(v) : v.replace(/\r\n/g, "\n");
        else photoBytes = v.size;
      }
      if (params.chat_id !== undefined) params.chat_id = Number(params.chat_id);
    }
    calls.push({ method, params, photoBytes });
    const reply = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const f = failures.get(method);
    if (f && f.times > 0) {
      f.times--;
      return reply(f.code, { ok: false, error_code: f.code, description: f.description });
    }
    const chatId = Number(params.chat_id);
    if ((method === "sendMessage" || method === "sendPhoto") && chatId > 0 && !startedUsers.has(chatId))
      return reply(403, {
        ok: false,
        error_code: 403,
        description: "Forbidden: bot can't initiate conversation with a user",
      });
    if (method === "sendMessage" || method === "sendPhoto")
      return reply(200, { ok: true, result: { message_id: nextMessageId++, chat: { id: chatId } } });
    return reply(200, { ok: true, result: true });
  });
  server.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    startedUsers,
    of: (method: string) => calls.filter((c) => c.method === method),
    fail(method: string, code: number, description: string, times = 1) {
      failures.set(method, { code, description, times });
    },
    reset() {
      calls.length = 0;
      failures.clear();
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
export type FakeBotApi = Awaited<ReturnType<typeof startFakeBotApi>>;
