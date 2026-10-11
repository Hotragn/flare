// The host's flow under /app/ (FE2, H1 to H6; Plans P1 to P3). Camera first, a 768 px draft
// upload, six words, quorum, host line, Send, the share sheet with the link and the SMS form,
// then the host controls (+1, cancel, Done, text yes). Everything readable is sealed on this
// phone before it is sent (ADR-0008); only labels cross for places (ADR-0009).
import type { Label, Step } from "@flare/shared/icd/engine";
import type { ClientIcd } from "@flare/shared/icd/index";
import type { LatLon, MapPack, Place } from "@flare/shared/icd/map";
import { encodePlain, encodePlainPlan } from "@flare/shared/plaintext";
import type { NoticeTextT, SealedGatheringT } from "@flare/shared/sealed";
import { t } from "#lib/copy/index.ts";
import { feedback } from "#lib/motion/feedback.ts";
import type { Access } from "../../components/parts";
import { BASE, bearer, getJson, write } from "./api.ts";
import type {
  CreateGathering,
  DraftResponse,
  GatheringView,
  LadderResponse,
  Member,
  PlanStepWire,
} from "./api-types.ts";
import { distanceM } from "./compass.ts";
import type { Deps } from "./deps.ts";
import { errorKey } from "./errors.ts";
import { clock, fromB64url, fromUtf8, minutesUntil, newToken, offsetFrom, utf8 } from "./format.ts";

export type HostScreen =
  | "camera"
  | "develop"
  | "send"
  | "sent"
  | "kindling"
  | "lit"
  | "outside"
  | "gone"
  | "plan-ask"
  | "plan-ladder";

export type DraftView = "developing" | "drafted" | "hub-unreachable" | "offline";
export type Spot = { name: string; key: string; lat: number; lon: number };

const HOST_GROUP = "flare.hostGroup"; // id only; the key stays in IndexedDB
const DRAFT_BUDGET_MS = 6000; // the server answers with the template after 6 s (openapi drafts)

export class HostFlow {
  screen = $state<HostScreen>("camera");
  photoBlob: Blob | null = null;
  photo = $state("");
  draft = $state<DraftView>("developing");
  words = $state("");
  alt = $state("");
  tier = $state<"hub" | "rules">("hub");
  spot = $state<Spot | null>(null);
  askLocation = $state(false);
  quorum = $state("2");
  hostName = $state("");
  hostLine = $state("");
  access = $state<Access | null>(null);
  nature = $state("");
  sending = $state(false);
  error = $state("");
  view = $state<GatheringView | null>(null);
  link = $state("");
  copied = $state(false);
  textYesUsed = $state(0);
  marked = $state<string[]>([]);
  members = $state<{ id: string; name: string }[]>([]);
  busy = $state(false);
  offsetMs = 0;
  // Plans
  ask = $state("");
  startAt = $state<number | null>(null);
  deadlineAt = $state<number | null>(null);
  steps = $state<{ name: string; place: string; minutes: number; access: string }[]>([]);
  ladderTier = $state<"hub" | "rules">("hub");

  #d: Deps;
  #pack: MapPack | null = null;
  #group: ClientIcd.GroupRecord | null = null;
  #fragment: string | null = null;
  #stopLive: (() => void) | null = null;
  #candidates: { label: Label; place: Place; name: string }[] = [];

  constructor(d: Deps) {
    this.#d = d;
    this.hostName = storedName();
  }

  get askName(): boolean {
    return !this.#group && !storedName();
  }
  get have(): number {
    const v = this.view;
    return v ? Math.max(1, v.quorum - v.need) : 1;
  }
  get serverNow(): number {
    return this.#d.now() + this.offsetMs;
  }
  get tz(): string {
    return this.#d.tz;
  }
  /** Placeholder words for the typed fallback (ADR-0007), from the map pack. */
  get chips(): string[] {
    const m = this.#d.maps;
    if (!m || !this.#pack || !this.spot) return [];
    try {
      return m.placeWords(this.#pack, this.spot).slice(0, 6);
    } catch {
      return [];
    }
  }

  async loadPack(area: string): Promise<void> {
    const m = this.#d.maps;
    if (!m) return;
    try {
      this.#pack = await m.load(area);
    } catch {
      this.#pack = null;
    }
  }

  async loadGroup(): Promise<void> {
    const id = storedGroup();
    if (!id) return;
    this.#group = await this.#d.store.group(id);
    this.#fragment = this.#group ? await this.#d.store.fragment(id) : null;
    if (this.#group && !this.#fragment) this.#group = null; // no key for links: start a new group
  }

  // ---------- H1, H2: photo and draft ----------

  /** A captured or picked photo, already 768 px JPEG q0.7 (lab report 08). */
  async usePhoto(jpeg: Blob, online = globalThis.navigator?.onLine !== false): Promise<void> {
    this.photoBlob = jpeg;
    if (this.photo) URL.revokeObjectURL(this.photo);
    this.photo = URL.createObjectURL(jpeg);
    this.screen = "develop";
    this.draft = online ? "developing" : "offline";
    this.askLocation = !this.spot;
    if (online) await this.#draftWords(jpeg);
  }

  async #draftWords(jpeg: Blob): Promise<void> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), DRAFT_BUDGET_MS + 2000);
    try {
      const r = await this.#d.fetch(`${BASE}/drafts`, {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: jpeg,
        signal: ctl.signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as DraftResponse;
      this.alt = d.alt;
      this.tier = d.tier;
      if (d.tier === "hub" && d.invite) {
        this.words = d.invite;
        this.draft = "drafted";
      } else this.draft = "hub-unreachable"; // the template tier: the host writes six words (BR-AI-1)
    } catch {
      this.draft = globalThis.navigator?.onLine === false ? "offline" : "hub-unreachable";
    } finally {
      clearTimeout(timer);
    }
  }

  /** Spot from the phone's location (SRS-CRE-3): nearest named feature, else the street. */
  setPosition(at: LatLon): void {
    this.askLocation = false;
    const m = this.#d.maps;
    const named = m && this.#pack ? m.nameSpot(this.#pack, at) : null;
    this.spot = named ? { ...named, ...at } : { name: "", key: "", ...at };
    if (m && this.#pack) {
      try {
        this.access = m.accessLine(this.#pack, at);
        this.nature = m.natureLine(this.#pack, at, new Date(this.serverNow), this.#d.tz);
        this.#candidates = m.emberCandidates(this.#pack, at).map((p, i) => ({
          label: `c${i + 1}` as Label,
          place: p,
          name: p.name ?? benchName(p, distanceM(at, p)),
        }));
      } catch {
        this.access = null;
      }
    }
  }

  /** Typed spot when location is off (perm.locationHost.denied); no compass target then. */
  typeSpot(name: string): void {
    this.askLocation = false;
    if (name.trim()) this.spot = { name: name.trim(), key: name.trim(), lat: 0, lon: 0 };
  }

  useWords(words: string): void {
    this.words = words;
    const host = this.hostName || storedName();
    if (!this.hostLine)
      this.hostLine = t("send.hostLine", { host: host || t("join.namePlaceholder"), spot: this.spot?.name || "" });
    this.screen = "send";
  }

  // ---------- H3: send ----------

  async send(kind: "flare" | "plan" = "flare"): Promise<boolean> {
    const d = this.#d;
    this.error = "";
    this.sending = true;
    try {
      const host = (this.hostName || storedName()).trim();
      if (!host) return false;
      rememberName(host);
      const group = await this.#ensureGroup(host);
      if (!group) return false;
      const key = group.key;
      const id = crypto.randomUUID();
      const spot = this.spot ?? { name: "", key: "", lat: 0, lon: 0 };
      const sealed: SealedGatheringT = {
        v: 1,
        host_name: host.slice(0, 40),
        invite: (kind === "plan" ? this.ask : this.words).slice(0, 80),
        scene: this.alt.slice(0, 200),
        host_line: (this.hostLine || t("send.hostLine", { host, spot: spot.name })).slice(0, 120),
        spot: { name: spot.name.slice(0, 120), lat: spot.lat, lon: spot.lon, key: spot.key.slice(0, 140) },
        ...(this.#candidates.length
          ? {
              candidates: Object.fromEntries(
                this.#candidates.map((c) => [
                  c.label,
                  { name: c.name.slice(0, 120), lat: c.place.lat, lon: c.place.lon, key: c.place.osm_id },
                ]),
              ),
            }
          : {}),
        ...(kind === "plan"
          ? {
              steps: Object.fromEntries(
                this.steps.map((s, i) => [
                  `step:${i + 1}`,
                  {
                    name: s.name.slice(0, 40),
                    place: { name: spot.name, lat: spot.lat, lon: spot.lon, key: spot.key },
                  },
                ]),
              ),
            }
          : {}),
        ...(this.nature ? { nature_line: this.nature.slice(0, 120) } : {}),
        ...(this.access ? { access: this.access } : {}),
      };
      const notice: NoticeTextT = {
        v: 1,
        host: host.slice(0, 40),
        spot: spot.name.slice(0, 120),
        ...(this.#candidates.length
          ? { benches: Object.fromEntries(this.#candidates.map((c) => [c.label, c.name.slice(0, 120)])) }
          : {}),
        ...(kind === "plan"
          ? { steps: Object.fromEntries(this.steps.map((s, i) => [`step:${i + 1}`, s.name.slice(0, 40)])) }
          : {}),
      };
      const body: CreateGathering = {
        id,
        kind,
        quorum: Number(this.quorum),
        tz: d.tz,
        sealed: await d.crypto.sealJson(key, `g:${id}`, sealed),
        notice_ct: await d.crypto.sealJson(key, `n:${id}`, notice),
        ...(kind === "flare" && this.#candidates.length
          ? { ember_candidates: this.#candidates.map((c) => c.label) }
          : {}),
        ...(kind === "plan" && this.startAt && this.deadlineAt
          ? {
              plan: {
                start_at: new Date(this.startAt).toISOString(),
                deadline_at: new Date(this.deadlineAt).toISOString(),
                steps: this.steps.map(
                  (s, i): PlanStepWire => ({
                    step: (i + 1) as Step,
                    minutes: s.minutes,
                    place: `step:${i + 1}` as Label,
                  }),
                ),
              },
            }
          : {}),
      };
      const r = await write<GatheringView>(d, "POST", `/groups/${group.groupId}/gatherings`, body);
      if (!r.ok) {
        this.error = t(errorKey(r.code));
        return false;
      }
      await d.store.rememberGathering(id, group.groupId);
      this.link = `${globalThis.location?.origin ?? ""}/g/${id}/#k=${this.#fragment}`;
      this.view = r.value ?? null;
      if (this.photoBlob && kind === "flare") void this.#uploadPhoto(id, key, this.photoBlob);
      this.screen = "sent";
      this.#follow(id);
      return true;
    } catch {
      this.error = t("err.sealPhoto");
      return false;
    } finally {
      this.sending = false;
    }
  }

  async #ensureGroup(host: string): Promise<ClientIcd.GroupRecord | null> {
    if (this.#group && this.#fragment) return this.#group;
    const d = this.#d;
    const { key, fragment } = await d.crypto.newGroupKey();
    const groupId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const token = newToken();
    const nameCt = await d.crypto.seal(key, `m:${groupId}:${memberId}`, utf8(host));
    const r = await write<unknown>(d, "POST", "/groups", {
      id: groupId,
      member: { id: memberId, name_ct: nameCt, write_token: token },
    });
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      return null;
    }
    const g: ClientIcd.GroupRecord = { groupId, key, memberId, token, names: { [memberId]: host } };
    await d.store.saveGroup(g);
    rememberGroup(groupId);
    this.#group = g;
    this.#fragment = fragment;
    return g;
  }

  async #uploadPhoto(id: string, key: CryptoKey, jpeg: Blob): Promise<void> {
    try {
      const sealed = await this.#d.crypto.seal(key, `p:${id}`, new Uint8Array(await jpeg.arrayBuffer()));
      const bytes = fromB64url(sealed);
      const r = await write<unknown>(this.#d, "PUT", `/gatherings/${id}/photo`, bytes);
      if (!r.ok) this.error = t(errorKey(r.code));
    } catch {
      this.error = t("err.sealPhoto"); // the link still works without the photo (openapi createGathering)
    }
  }

  // ---------- H4: share ----------

  /** The share sheet with the link (SRS-CRE-8). Call from a tap. */
  async share(): Promise<void> {
    const host = this.hostName || storedName();
    const v = this.view;
    const kind = v?.kind ?? "flare";
    const title = kind === "plan" ? t("share.plan.title", { host }) : t("share.flare.title", { host });
    const text =
      kind === "plan"
        ? t("share.plan.text", { ask: this.ask, deadline: this.deadlineAt ? clock(this.deadlineAt, this.#d.tz) : "" })
        : t("share.flare.text", { invite: this.words, n: v?.need ?? Number(this.quorum) - 1 });
    try {
      if (navigator.share) await navigator.share({ title, text, url: this.link });
      else await this.copyText();
    } catch {
      // The host closed the share sheet: nothing to do.
    }
  }

  /** The plain-text form for SMS or satellite texting (SRS-IF-6, plain-text.md). */
  plainText(): string {
    const v = this.view;
    if (!v) return "";
    if (v.kind === "plan" && this.deadlineAt)
      return encodePlainPlan({
        code: v.short_code,
        ask: this.ask,
        need: v.need,
        by: clock(this.deadlineAt, this.#d.tz).replace(" ", ""),
      });
    const ends = v.next_change_at ? clock(v.next_change_at, this.#d.tz).replace(" ", "") : "";
    return encodePlain({ code: v.short_code, spot: this.spot?.name ?? "", need: v.need, ends });
  }

  async copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${this.plainText()}\n${this.link}`);
      this.copied = true;
    } catch {
      this.copied = false;
    }
  }

  // ---------- H5, H6: host controls ----------

  #follow(id: string): void {
    this.#stopLive?.();
    this.#stopLive = this.#d.live.follow(id, (v, off) => {
      const was = this.view?.state;
      this.offsetMs = off || offsetFrom(v.server_time, this.#d.now());
      this.view = v;
      if (v.state !== was && was) {
        if (v.state === "lit") {
          feedback("lit");
          void this.#loadMembers();
        } else if (v.state === "ember") feedback("ember");
        else if (v.state === "gone") feedback("gone");
      }
      if (this.screen !== "sent" || v.state !== "kindling") this.#route();
    });
  }

  #route(): void {
    const v = this.view;
    if (!v) return;
    if (v.state === "gone") this.screen = v.ended === "thanks_for_coming" ? "outside" : "gone";
    else if (v.state === "lit" || (v.state === "ember" && v.need === 0)) this.screen = "lit";
    else this.screen = "kindling";
  }

  /** "Pocket it": the host's live screen. */
  pocket(): void {
    this.#route();
    if (this.screen === "sent") this.screen = "kindling";
  }

  get sentMin(): number {
    const v = this.view;
    return v ? Math.max(0, Math.floor((this.serverNow - Date.parse(v.created_at)) / 60_000)) : 0;
  }
  get shrinkMin(): number | null {
    const v = this.view;
    return v?.next_change_at ? minutesUntil(v.next_change_at, this.serverNow) : null;
  }

  async textYes(reply: string): Promise<void> {
    const v = this.view;
    if (!v) return;
    const code = reply
      .trim()
      .toUpperCase()
      .replace(/^IN\s+/, "");
    this.busy = true;
    const r = await write<GatheringView>(this.#d, "POST", `/gatherings/${v.id}/text-yes`, { code });
    this.busy = false;
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      return;
    }
    this.textYesUsed += 1;
    this.error = "";
    if (r.value) this.view = r.value;
    this.#route();
  }

  async cancel(): Promise<void> {
    await this.#end("cancel");
  }
  async done(): Promise<void> {
    await this.#end("done");
  }
  async #end(what: "cancel" | "done"): Promise<void> {
    const v = this.view;
    if (!v) return;
    this.busy = true;
    const r = await write<GatheringView>(this.#d, "POST", `/gatherings/${v.id}/${what}`, {});
    this.busy = false;
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      return;
    }
    if (r.value) this.view = r.value;
    this.screen = what === "done" ? "outside" : "gone";
    this.#stopLive?.();
  }

  /** Host +1 for a member or someone else (BR-H-1 to -5). */
  async plusOne(who: { id: string } | "someone_else"): Promise<void> {
    const v = this.view;
    if (!v) return;
    this.busy = true;
    const body =
      who === "someone_else"
        ? { for: "someone_else", recorded_at: new Date(this.serverNow).toISOString() }
        : { for: "member", member_id: who.id, recorded_at: new Date(this.serverNow).toISOString() };
    const r = await write<{ gathering: GatheringView; counted: boolean }>(
      this.#d,
      "POST",
      `/gatherings/${v.id}/arrivals`,
      body,
    );
    this.busy = false;
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      return;
    }
    if (r.value) this.view = r.value.gathering;
    if (who !== "someone_else") this.marked = [...this.marked, who.id];
  }

  /** Member names, opened here with the group key; only the host's phone sees them (host.plus.body). */
  async #loadMembers(): Promise<void> {
    const g = this.#group;
    if (!g) return;
    const r = await getJson<{ members: Member[] }>(this.#d, `/groups/${g.groupId}`, bearer(g));
    if (!r.ok) return;
    const out: { id: string; name: string }[] = [];
    for (const m of r.value.members) {
      if (m.id === g.memberId) continue;
      if (!m.name_ct) {
        out.push({ id: m.id, name: t("member.telegramFriend") });
        continue;
      }
      try {
        out.push({ id: m.id, name: fromUtf8(await this.#d.crypto.open(g.key, `m:${g.groupId}:${m.id}`, m.name_ct)) });
      } catch {
        // Sealed under another key: skipped.
      }
    }
    this.members = out;
  }

  close(): void {
    this.#stopLive?.();
    if (this.photo) URL.revokeObjectURL(this.photo);
  }

  // ---------- P1, P2: Plans ----------

  startPlan(): void {
    this.screen = "plan-ask";
    this.quorum = "3";
    const now = this.serverNow;
    const start = Math.ceil((now + 60 * 60_000) / (15 * 60_000)) * 15 * 60_000;
    this.startAt = this.startAt ?? start;
    this.deadlineAt = this.deadlineAt ?? start - 20 * 60_000;
  }

  /** BR-P-1 to -3: answers close ≥ 10 min before the start, ≥ 10 min from now; start within 36 h. */
  planError(): string {
    const now = this.serverNow;
    if (!this.startAt || !this.deadlineAt) return "";
    if (this.startAt - now > 36 * 3_600_000) return t("plan.err.tooFar");
    if (this.deadlineAt - now < 10 * 60_000) return t("plan.err.tooSoon");
    if (this.startAt - this.deadlineAt < 10 * 60_000) return t("plan.err.tooClose");
    return "";
  }

  async draftLadder(totalMinutes = 60): Promise<void> {
    this.screen = "plan-ladder";
    this.steps = [];
    try {
      const r = await this.#d.fetch(`${BASE}/drafts/ladder`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ask: this.ask.slice(0, 80), total_minutes: Math.max(40, totalMinutes) }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const l = (await r.json()) as LadderResponse;
      this.ladderTier = l.tier;
      this.steps = l.steps.map((s) => ({
        name: s.label,
        place: this.spot?.name ?? "",
        minutes: s.minutes,
        access: "",
      }));
    } catch {
      this.ladderTier = "rules";
      const m = [totalMinutes, Math.round(totalMinutes / 2), Math.round(totalMinutes / 4), 10].map((x, i, a) =>
        Math.max(5 + (a.length - 1 - i) * 5, x),
      );
      const names = [t("ladder.tpl.1"), t("ladder.tpl.2"), t("ladder.tpl.3"), t("ladder.tpl.4")];
      this.steps = m.map((minutes, i) => ({ name: names[i] ?? "", place: this.spot?.name ?? "", minutes, access: "" }));
    }
  }

  /** BR-P-4: minutes strictly decreasing, 5 or more. */
  ladderError(): string {
    for (let i = 1; i < this.steps.length; i++) {
      const a = this.steps[i - 1];
      const b = this.steps[i];
      if (!a || !b || b.minutes >= a.minutes || b.minutes < 5) return t("ladder.err.order");
    }
    return "";
  }
}

/** "the bench 80 m away" for an unnamed bench or table (BR-E-1). */
function benchName(p: Place, m: number): string {
  const r = Math.round(m / 10) * 10;
  return p.kind === "picnic_table" ? t("place.tableNear", { m: r }) : t("place.benchNear", { m: r });
}

function storedName(): string {
  try {
    return localStorage.getItem("flare.name") ?? "";
  } catch {
    return "";
  }
}
function rememberName(n: string): void {
  try {
    localStorage.setItem("flare.name", n);
  } catch {
    // Private mode: asked again next time.
  }
}
function storedGroup(): string | null {
  try {
    return localStorage.getItem(HOST_GROUP);
  } catch {
    return null;
  }
}
function rememberGroup(id: string): void {
  try {
    localStorage.setItem(HOST_GROUP, id);
  } catch {
    // Private mode: a new group each time, which still works.
  }
}
