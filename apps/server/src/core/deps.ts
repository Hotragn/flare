// What the server's pieces share, and the `deps` INT's mount functions receive
// (url-map.md: mountTelegram(app, deps), mountPreview(app, deps), createPush(deps)).
import type { Engine, Id, Label, Step } from "@flare/shared/icd/engine";
import type { CloudTier } from "../cloud.ts";
import type { Db } from "../db/db.ts";
import type { HubRelay } from "../hub/relay.ts";
import type { EventBus } from "./events.ts";

export type Clock = { now(): Date };
export const systemClock: Clock = { now: () => new Date() };

export type Config = {
  version: string;
  publicBaseUrl: string;
  vapidPublicKey: string | null;
  telegramBotUsername: string | null;
};

/** Context handed to push and Telegram senders after commit. Never logged. */
export type Notify = {
  gatheringId: Id;
  groupId: Id;
  kind: "flare" | "plan";
  state: "kindling" | "lit" | "ember" | "gone";
  ended: "not_this_time" | "thanks_for_coming" | null;
  noticeCt: string; // base64url, copied into the push payload (asyncapi push channel)
  startAt: string | null; // Plan start, for "{time}"
  need: number;
  headcount: number | null;
  /** Readable post text for Telegram groups only (ADR-0013); null for link groups. */
  telegram: Record<string, unknown> | null;
};

export type PushEffect = { event: string; label?: Label; step?: Step };
export type TelegramEffect = { action: "edit_count" | "lit" | "ember" | "smaller" | "final" };

/** INT implements these. Errors are caught and counted; they never undo a committed change. */
export interface EffectSink {
  /** After a gathering is created (the bot posts to a Telegram group, ADR-0013). */
  created?(n: Notify): Promise<void>;
  push?(effect: PushEffect, to: Id[], n: Notify): Promise<void>;
  telegram?(effect: TelegramEffect, n: Notify): Promise<void>;
}

export type Deps = {
  relay: HubRelay;
  db: Db | null;
  version: string;
  webBuildDir?: string;
  engine?: Engine;
  events?: EventBus;
  clock?: Clock;
  config?: Partial<Config>;
  effects?: EffectSink;
  /** Ladder hub budget, ms (ADR-0007: 8 s). */
  ladderTimeoutMs?: number;
  /** LADDER_AGENT=1: draft Plan ladders with the Mastra agent (ADR-0025). Default off. */
  ladderAgent?: boolean;
  /** DigitalOcean cloud tier (ADR-0022); null when no scoped key is configured. */
  cloud?: CloudTier | null;
};

/** The resolved deps every route and INT module gets. */
export type Ctx = {
  relay: HubRelay;
  db: Db | null;
  engine: Engine | null;
  events: EventBus;
  clock: Clock;
  config: Config;
  effects: EffectSink;
  ladderTimeoutMs: number;
  ladderAgent: boolean;
  cloud: CloudTier | null;
};
