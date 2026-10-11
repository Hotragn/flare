// ICD-5 store (PW2): IndexedDB database `flare`, version 1, with the seven object stores of
// 07-offline-sync-and-ai.md A2. Uses idb 8.0.4. The page and the service worker both open it
// (same origin), so the service worker can open a push notice with the group key.
import type { ClientIcd } from "@flare/shared/icd/index";
import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { fragmentOf, linkKey } from "../crypto/index.ts";

type GroupRecord = ClientIcd.GroupRecord;
type OutboxItem = ClientIcd.OutboxItem;

export const DB_NAME = "flare";
export const DB_VERSION = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** What the outbox keeps per item: the ICD item plus its order, auth and group. */
export type OutboxRecord = OutboxItem & {
  seq: number;
  /** `Bearer {memberId}.{token}` at the time of the tap, or null for open writes. */
  auth: string | null;
  groupId: string | null;
};

type GroupRow = GroupRecord & { fragment: string };
type SeenRow = { gatheringId: string; groupId: string | null; version: number; goneAt: number | null };
type LitRow = { gatheringId: string; data: unknown; savedAt: number };
type TicketRow = { gatheringId: string; ticket: string; savedAt: number };
type ConditionsRow = { gatheringId: string; text: string };

interface FlareDB extends DBSchema {
  groups: { key: string; value: GroupRow };
  needs: { key: string; value: unknown };
  conditions: { key: string; value: ConditionsRow };
  lit: { key: string; value: LitRow };
  outbox: { key: string; value: OutboxRecord; indexes: { "by-seq": number; "by-group": string } };
  tickets: { key: string; value: TicketRow };
  seen: { key: string; value: SeenRow; indexes: { "by-group": string } };
}

/** The phone is out of storage (shown as err.storageFull). */
export class StorageFullError extends Error {
  constructor() {
    super("storage full");
    this.name = "StorageFullError";
  }
}

function isQuota(e: unknown): boolean {
  return e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (isQuota(e)) throw new StorageFullError();
    throw e;
  }
}

function openFlare(name: string): Promise<IDBPDatabase<FlareDB>> {
  return openDB<FlareDB>(name, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("groups", { keyPath: "groupId" });
      db.createObjectStore("needs");
      db.createObjectStore("conditions", { keyPath: "gatheringId" });
      db.createObjectStore("lit", { keyPath: "gatheringId" });
      const outbox = db.createObjectStore("outbox", { keyPath: "idemKey" });
      outbox.createIndex("by-seq", "seq");
      outbox.createIndex("by-group", "groupId");
      db.createObjectStore("tickets", { keyPath: "gatheringId" });
      const seen = db.createObjectStore("seen", { keyPath: "gatheringId" });
      seen.createIndex("by-group", "groupId");
    },
  });
}

export type FlareStore = ClientIcd.Store & {
  /** The base64url key for new links in this group (ADR-0008). */
  fragment(groupId: string): Promise<string | null>;
  groupIds(): Promise<string[]>;
  /** Ties a gathering to its group so the service worker can find the key for a push. */
  rememberGathering(gatheringId: string, groupId: string): Promise<void>;
  groupOf(gatheringId: string): Promise<GroupRecord | null>;
  seenVersion(gatheringId: string): Promise<number>;
  /** Stores the highest version seen; returns false if `version` is older (A4 version guard). */
  saveSeen(gatheringId: string, version: number, groupId?: string | null): Promise<boolean>;
  /** At Gone: delete saved Lit data and conditions, keep tickets (A4). */
  gone(gatheringId: string, now?: number): Promise<void>;
  saveConditions(gatheringId: string, text: string): Promise<void>;
  conditions(gatheringId: string): Promise<string | null>;
  saveTicket(gatheringId: string, ticket: string, now?: number): Promise<void>;
  ticket(gatheringId: string): Promise<string | null>;
  useTicket(gatheringId: string): Promise<void>;
  /** Deletes what has outlived its A2 lifetime. Returns the number of rows removed. */
  sweep(now?: number): Promise<number>;
  outboxPut(r: OutboxRecord): Promise<void>;
  outboxAll(): Promise<OutboxRecord[]>;
  outboxDelete(idemKey: string): Promise<void>;
  close(): void;
};

export function createStore(name = DB_NAME, clock: () => number = Date.now): FlareStore {
  let dbp: Promise<IDBPDatabase<FlareDB>> | null = null;
  const db = () => {
    dbp ??= openFlare(name);
    return dbp;
  };

  const withKey = (row: GroupRow | undefined): GroupRecord | null => {
    if (!row) return null;
    linkKey(row.key, row.fragment);
    const { fragment: _f, ...g } = row;
    return g;
  };

  async function deleteGathering(gatheringId: string): Promise<void> {
    const tx = (await db()).transaction(["lit", "conditions", "tickets", "seen"], "readwrite");
    await Promise.all([
      tx.objectStore("lit").delete(gatheringId),
      tx.objectStore("conditions").delete(gatheringId),
      tx.objectStore("tickets").delete(gatheringId),
      tx.objectStore("seen").delete(gatheringId),
      tx.done,
    ]);
  }

  const store: FlareStore = {
    async group(groupId) {
      return withKey(await (await db()).get("groups", groupId));
    },
    async saveGroup(g) {
      const fragment = fragmentOf(g.key) ?? (await (await db()).get("groups", g.groupId))?.fragment;
      if (!fragment) throw new TypeError("saveGroup: key has no fragment; import it with importFragment first");
      const row: GroupRow = {
        groupId: g.groupId,
        key: g.key,
        memberId: g.memberId,
        token: g.token,
        names: { ...g.names },
        fragment,
      };
      await guard(async () => (await db()).put("groups", row));
    },
    async forget(groupId) {
      const d = await db();
      const seen = await d.getAllFromIndex("seen", "by-group", groupId);
      for (const s of seen) await deleteGathering(s.gatheringId);
      const items = await d.getAllFromIndex("outbox", "by-group", groupId);
      const tx = d.transaction(["outbox", "groups"], "readwrite");
      const ops: Promise<unknown>[] = [tx.objectStore("groups").delete(groupId)];
      for (const it of items) {
        // Keep the forget request itself so the server deletes the member too (ADR-0015).
        const isForget = it.method === "DELETE" && it.path.startsWith(`/api/v1/groups/${groupId}/members/`);
        if (!isForget) ops.push(tx.objectStore("outbox").delete(it.idemKey));
      }
      await Promise.all([...ops, tx.done]);
    },
    async saveLit(gatheringId, data) {
      await guard(async () => (await db()).put("lit", { gatheringId, data, savedAt: clock() }));
    },
    async lit<T>(gatheringId: string) {
      const d = await db();
      const row = await d.get("lit", gatheringId);
      if (!row) return null;
      if (clock() - row.savedAt > DAY_MS) {
        await d.delete("lit", gatheringId);
        return null;
      }
      return row.data as T;
    },
    async needs<T>() {
      return ((await (await db()).get("needs", "profile")) as T | undefined) ?? null;
    },
    async saveNeeds(n) {
      await guard(async () => (await db()).put("needs", n, "profile"));
    },
    async fragment(groupId) {
      return (await (await db()).get("groups", groupId))?.fragment ?? null;
    },
    async groupIds() {
      return (await db()).getAllKeys("groups");
    },
    async rememberGathering(gatheringId, groupId) {
      const d = await db();
      const row = await d.get("seen", gatheringId);
      await guard(async () =>
        d.put("seen", { gatheringId, groupId, version: row?.version ?? 0, goneAt: row?.goneAt ?? null }),
      );
    },
    async groupOf(gatheringId) {
      const groupId = (await (await db()).get("seen", gatheringId))?.groupId;
      return groupId ? store.group(groupId) : null;
    },
    async seenVersion(gatheringId) {
      return (await (await db()).get("seen", gatheringId))?.version ?? 0;
    },
    async saveSeen(gatheringId, version, groupId = null) {
      const d = await db();
      const tx = d.transaction("seen", "readwrite");
      const row = await tx.store.get(gatheringId);
      if (row && row.version > version) {
        await tx.done;
        return false;
      }
      await tx.store.put({
        gatheringId,
        groupId: groupId ?? row?.groupId ?? null,
        version,
        goneAt: row?.goneAt ?? null,
      });
      await tx.done;
      return true;
    },
    async gone(gatheringId, now = clock()) {
      const d = await db();
      const tx = d.transaction(["lit", "conditions", "seen"], "readwrite");
      const seen = await tx.objectStore("seen").get(gatheringId);
      await Promise.all([
        tx.objectStore("lit").delete(gatheringId),
        tx.objectStore("conditions").delete(gatheringId),
        tx.objectStore("seen").put({
          gatheringId,
          groupId: seen?.groupId ?? null,
          version: seen?.version ?? 0,
          goneAt: seen?.goneAt ?? now,
        }),
        tx.done,
      ]);
    },
    async saveConditions(gatheringId, text) {
      await guard(async () => (await db()).put("conditions", { gatheringId, text }));
    },
    async conditions(gatheringId) {
      return (await (await db()).get("conditions", gatheringId))?.text ?? null;
    },
    async saveTicket(gatheringId, ticket, now = clock()) {
      await guard(async () => (await db()).put("tickets", { gatheringId, ticket, savedAt: now }));
    },
    async ticket(gatheringId) {
      return (await (await db()).get("tickets", gatheringId))?.ticket ?? null;
    },
    async useTicket(gatheringId) {
      await (await db()).delete("tickets", gatheringId);
    },
    async sweep(now = clock()) {
      const d = await db();
      let removed = 0;
      for (const row of await d.getAll("lit")) {
        if (now - row.savedAt > DAY_MS) {
          await d.delete("lit", row.gatheringId);
          removed++;
        }
      }
      for (const row of await d.getAll("outbox")) {
        if (now - Date.parse(row.recorded_at) > DAY_MS) {
          await d.delete("outbox", row.idemKey);
          removed++;
        }
      }
      for (const s of await d.getAll("seen")) {
        if (s.goneAt !== null && now - s.goneAt > DAY_MS) {
          await deleteGathering(s.gatheringId);
          removed++;
        }
      }
      return removed;
    },
    async outboxPut(r) {
      await guard(async () => (await db()).put("outbox", r));
    },
    async outboxAll() {
      return (await db()).getAllFromIndex("outbox", "by-seq");
    },
    async outboxDelete(idemKey) {
      await (await db()).delete("outbox", idemKey);
    },
    close() {
      if (dbp) void dbp.then((d) => d.close());
      dbp = null;
    },
  };
  return store;
}
