// Wires Integrations (Telegram, Web Push, link previews) into the server: the ports INT asked
// for (docs/integrations/wiring.md) built from Backend's core, and Backend's EffectSink
// forwarded to INT's senders. Everything is optional: without a bot token, VAPID keys or a
// database the matching feature is off and the routes answer 503 not_configured.
import type { Hono } from "hono";
import type { Ctx } from "./core/deps.ts";
import { loadAnswers, loadRow, runEvent, toIcd } from "./core/gatherings.ts";
import { ApiError } from "./http/errors.ts";
import { memberFromHeader } from "./http/middleware.ts";
import { mountPreview } from "./preview/index.ts";
import { createPush, vapidFromEnv } from "./push/index.ts";
import { meView } from "./routes/gatherings.ts";
import { type Bot, mountTelegram, mountTelegramOff, telegramEnv, type YesResult } from "./telegram/index.ts";

export type Integrations = {
  mount(app: Hono, ctx: Ctx): void;
  /** After listen: posts Telegram Flares that never got their post (restart recovery). */
  resume(): Promise<void>;
  close(): void;
};

export function integrations(env: NodeJS.ProcessEnv = process.env, webBuildDir?: string): Integrations {
  let bot: Bot | null = null;

  return {
    mount(app, ctx) {
      const db = ctx.db;
      const now = () => ctx.clock.now();

      const view = async (gid: string) => {
        if (!db || !ctx.engine) return null;
        const row = await loadRow(db, gid);
        if (!row || row.state === "gone") return null;
        const v = ctx.engine.view(toIcd(row), await loadAnswers(db, gid), now().toISOString());
        return { need: v.need, until: v.next_change_at };
      };

      const tg = telegramEnv(env);
      if (tg && db) {
        bot = mountTelegram(app, {
          db,
          ...tg,
          // Tests point the bot at a fake Bot API; production leaves it unset.
          ...(env.TELEGRAM_API_BASE_URL ? { apiBaseUrl: env.TELEGRAM_API_BASE_URL } : {}),
          async yes(gid, memberId): Promise<YesResult> {
            try {
              const out = await runEvent(
                ctx,
                gid,
                { type: "answer", member_id: memberId, answer: "yes", rules: [], ember_only: false },
                now(),
              );
              return out.changed ? "counted" : "already";
            } catch (e) {
              if (e instanceof ApiError) return "closed";
              throw e;
            }
          },
          view,
          async member(authorization) {
            try {
              const m = await memberFromHeader(authorization, db);
              return { memberId: m.id, groupId: m.group_id };
            } catch {
              return null;
            }
          },
          async me(gid, memberId) {
            const row = await loadRow(db, gid);
            if (!row) throw new ApiError(404, "not_found", "No such gathering");
            return meView(row, await loadAnswers(db, gid), memberId, now());
          },
        });
      } else mountTelegramOff(app);

      mountPreview(app, {
        need: async (gid) => (await view(gid))?.need ?? null,
        publicBaseUrl: ctx.config.publicBaseUrl,
        webBuildDir,
      });

      const vapid = vapidFromEnv(env);
      const push = vapid && db ? createPush({ db, vapid }) : null;

      // Backend calls these after commit; failures are caught there and never undo a change.
      ctx.effects.created = async (n) => {
        if (n.telegram) bot?.created(n.gatheringId);
      };
      ctx.effects.push = async (effect, to, n) => {
        await push?.notify(n.gatheringId, { ...effect, to } as Parameters<NonNullable<typeof push>["notify"]>[1]);
      };
      ctx.effects.telegram = async (effect, n) => {
        bot?.effect(n.gatheringId, effect.action);
      };
    },
    async resume() {
      await bot?.resume();
    },
    close() {
      bot?.close();
    },
  };
}
