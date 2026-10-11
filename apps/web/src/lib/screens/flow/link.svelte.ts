// The invitee's link page /g/{gatheringId}/#k={key} (FE3, I0 to I12; Plans P4 to P7).
// Opens the sealed gathering with the key from the fragment, follows the live view, and
// answers through the outbox. Nothing readable leaves the phone: names, conditions, needs and
// positions stay here; only rules, labels and pass/fail checks are sent (ADR-0008, ADR-0009).
import type { Label, Rule } from "@flare/shared/icd/engine";
import type { ClientIcd } from "@flare/shared/icd/index";
import type { LatLon, Needs } from "@flare/shared/icd/map";
import { SealedGathering, type SealedGatheringT } from "@flare/shared/sealed";
import { t } from "#lib/copy/index.ts";
import { feedback } from "#lib/motion/feedback.ts";
import type { Access, InviteInfo } from "../../components/parts";
import { bearer, type FailCode, getBytes, getJson, write } from "./api.ts";
import type { AnswerBody, ArrivalResult, GatheringView, Me, Member } from "./api-types.ts";
import { distanceM } from "./compass.ts";
import type { Deps } from "./deps.ts";
import { errorKey } from "./errors.ts";
import { clock, fromUtf8, newToken, offsetFrom, ruleChip, toB64url, utf8 } from "./format.ts";

export type LinkScreen =
  | "loading"
  | "missing-key"
  | "gone"
  | "invite"
  | "join"
  | "condition"
  | "readback"
  | "not-suit"
  | "in"
  | "lit"
  | "compass"
  | "here"
  | "ember"
  | "spark"
  | "spark-saved"
  | "outside"
  | "plan-invite"
  | "plan-lit"
  | "fade";

/** What the phone saves at Lit so the Lit screen and compass work with no signal (SRS-OFF-1). */
export type SavedLit = { view: GatheringView; sealed: SealedGatheringT; saved_at: number };

type Pending = { rules: Rule[]; emberOnly: boolean };

export class LinkFlow {
  screen = $state<LinkScreen>("loading");
  view = $state<GatheringView | null>(null);
  sealed = $state<SealedGatheringT | null>(null);
  me = $state<Me | null>(null);
  photo = $state("");
  error = $state("");
  busy = $state(false);
  queued = $state(false);
  takenBack = $state(false);
  savedAt = $state(""); // set when showing the offline copy
  walkMin = $state<number | null>(null);
  /** Read-back of the parsed condition (I3). */
  readBack = $state("");
  chips = $state<string[]>([]);
  condError = $state("");
  notSuit = $state<{ icon: string; text: string }[]>([]);
  sparkTicket = $state<string | null>(null);
  hereCount = $state(1);
  offsetMs = 0;

  #d: Deps;
  #id: string;
  #key: CryptoKey | null = null;
  #group: ClientIcd.GroupRecord | null = null;
  #names: Record<string, string> = {};
  #pending: Pending | null = null;
  #parsed: Rule[] = [];
  #stopLive: (() => void) | null = null;
  #position: LatLon | null = null;
  #wasLit = false;

  #bind: string | null;

  /** `bindToken` comes from a Telegram personal link (?bind=, telegram.md), already taken off the address. */
  constructor(d: Deps, gatheringId: string, bindToken: string | null = null) {
    this.#d = d;
    this.#id = gatheringId;
    this.#bind = bindToken;
  }

  get id(): string {
    return this.#id;
  }
  get isMember(): boolean {
    return this.#group !== null;
  }
  get canCondition(): boolean {
    return this.#d.conditions !== null;
  }
  get serverNow(): number {
    return this.#d.now() + this.offsetMs;
  }
  get tz(): string {
    return this.#d.tz;
  }

  /** Screen data for the invitee screens, from the opened blob. */
  get info(): InviteInfo | null {
    const s = this.sealed;
    if (!s) return null;
    return {
      host: s.host_name,
      words: s.invite,
      scene: s.scene,
      photo: this.photo,
      spot: s.spot.name,
      hostLine: s.host_line,
      walkMin: this.walkMin,
      access: (s.access ?? null) as Access | null,
      nature: s.nature_line ?? "",
      met: null,
    };
  }
  get have(): number {
    const v = this.view;
    return v ? Math.max(0, v.quorum - v.need) : 0;
  }
  /** The Ember place name, or the spot when no bench qualified (BR-E-4). */
  get emberPlace(): { name: string; meters: number | null } {
    const s = this.sealed;
    const label = this.view?.ember_choice;
    if (!s) return { name: "", meters: null };
    const c = label && label !== "spot" ? s.candidates?.[label] : undefined;
    if (!c) return { name: s.spot.name, meters: null };
    return { name: c.name, meters: Math.round(distanceM(s.spot, c)) };
  }
  /** Where Find them points: the Ember place once Ember starts, a Plan step's place, else the spot. */
  get target(): LatLon | null {
    const s = this.sealed;
    if (!s) return null;
    const v = this.view;
    const label = v?.ember_choice;
    if (label && label !== "spot" && s.candidates?.[label]) return s.candidates[label];
    const step = v?.plan?.current_step;
    if (step && s.steps?.[`step:${step}`]) return s.steps[`step:${step}`].place;
    return s.spot.lat === 0 && s.spot.lon === 0 ? null : s.spot; // a typed spot has no position
  }
  /** Plan steps for the Ladder, biggest first. */
  get steps(): { name: string; place: string; minutes: number; access: string }[] {
    const s = this.sealed;
    return (this.view?.plan?.steps ?? []).map((p) => {
      const st = s?.steps?.[`step:${p.step}`];
      return { name: st?.name ?? "", place: st?.place.name ?? "", minutes: p.minutes, access: "" };
    });
  }
  stepName(k: number | null | undefined): string {
    return (k && this.sealed?.steps?.[`step:${k}`]?.name) || "";
  }

  // ---------- open ----------

  async open(fragment: string | null): Promise<void> {
    const d = this.#d;
    try {
      this.#key = fragment ? await d.crypto.importFragment(fragment) : null;
    } catch {
      this.#key = null;
    }
    if (!this.#key) {
      this.screen = "missing-key"; // SRS-RES-2: no photo, no other data
      return;
    }
    const res = await getJson<GatheringView>(d, `/gatherings/${this.#id}`);
    if (!res.ok) {
      if (res.code === "network" && (await this.#openSaved())) return;
      if (res.code === "network")
        this.error = t(errorKey(res.code)); // stays on loading, with Try again
      else this.screen = "gone";
      return;
    }
    if (!(await this.#apply(res.value))) return;
    this.#group = await d.store.group(res.value.group_id);
    if (this.#group) {
      await this.#remember();
      await this.#loadMe();
      void this.#loadNames();
    }
    this.#route();
    void this.#loadPhoto();
    this.#follow();
  }

  close(): void {
    this.#stopLive?.();
    this.#stopLive = null;
    if (this.photo) URL.revokeObjectURL(this.photo);
  }

  async #openSaved(): Promise<boolean> {
    const saved = await this.#d.store.lit<SavedLit>(this.#id);
    if (!saved) return false;
    this.view = saved.view;
    this.sealed = saved.sealed;
    this.savedAt = clock(saved.saved_at, this.#d.tz);
    this.screen = "lit";
    return true;
  }

  /** Opens and checks the sealed blob; a wrong key reads as a missing key (SRS-RES-2). */
  async #apply(v: GatheringView): Promise<boolean> {
    const key = this.#key;
    if (!key) return false;
    this.offsetMs = offsetFrom(v.server_time, this.#d.now());
    if (!this.sealed || this.view?.sealed !== v.sealed) {
      try {
        const plain = await this.#d.crypto.openJson<unknown>(key, `g:${v.id}`, v.sealed);
        this.sealed = SealedGathering.parse(plain);
      } catch {
        this.screen = "missing-key";
        return false;
      }
    }
    this.view = v;
    if (v.state === "lit" && !this.#wasLit) {
      this.#wasLit = true;
      void this.#saveLit();
    }
    return true;
  }

  /** Ties this gathering to its group for the service worker and the outbox, then sends a Telegram bind once. */
  async #remember(): Promise<void> {
    const g = this.#group;
    if (!g) return;
    try {
      await this.#d.store.rememberGathering(this.#id, g.groupId);
    } catch {
      // Storage blocked: push notices for this gathering fall back to the open page.
    }
    const token = this.#bind;
    if (!token) return;
    this.#bind = null;
    const r = await write<Me>(this.#d, "POST", `/gatherings/${this.#id}/telegram-bind`, { token });
    if (r.ok && r.value) this.me = r.value;
  }

  async #saveLit(): Promise<void> {
    if (!this.view || !this.sealed) return;
    const data: SavedLit = { view: this.view, sealed: this.sealed, saved_at: this.#d.now() };
    try {
      await this.#d.store.saveLit(this.#id, data);
    } catch {
      // Storage full: the page still works online (err.storageFull shows on the Lit screen).
      this.error = t("err.storageFull");
    }
  }

  async #loadPhoto(): Promise<void> {
    const key = this.#key;
    if (!key || !this.view?.has_photo || this.photo) return;
    const r = await getBytes(this.#d, `/gatherings/${this.#id}/photo`);
    if (!r.ok) return;
    try {
      const plain = await this.#d.crypto.open(key, `p:${this.#id}`, toB64url(r.value));
      this.photo = URL.createObjectURL(new Blob([plain as Uint8Array<ArrayBuffer>], { type: "image/jpeg" }));
    } catch {
      // A photo that will not open is left blank; the invite still works.
    }
  }

  async #loadMe(): Promise<void> {
    const g = this.#group;
    if (!g) return;
    const r = await getJson<Me>(this.#d, `/gatherings/${this.#id}/me`, bearer(g));
    if (r.ok) this.me = r.value;
  }

  /** Member names opened on this phone, for "only with Amor" (BR-C-3). */
  async #loadNames(): Promise<void> {
    const g = this.#group;
    const key = this.#key;
    if (!g || !key) return;
    this.#names = { ...g.names };
    const r = await getJson<{ members: Member[] }>(this.#d, `/groups/${g.groupId}`, bearer(g));
    if (!r.ok) return;
    for (const m of r.value.members) {
      if (!m.name_ct || this.#names[m.id]) continue;
      try {
        this.#names[m.id] = fromUtf8(await this.#d.crypto.open(key, `m:${g.groupId}:${m.id}`, m.name_ct));
      } catch {
        // A name sealed under another key is skipped.
      }
    }
  }

  #follow(): void {
    this.#stopLive = this.#d.live.follow(this.#id, (v, off) => {
      this.offsetMs = off;
      const was = this.view?.state;
      void this.#apply(v).then((ok) => {
        if (!ok) return;
        if (v.state !== was) {
          if (v.state === "lit" && this.#counted()) feedback("lit");
          else if (v.state === "ember") feedback("ember");
          else if (v.state === "gone") feedback("gone");
          void this.#loadMe().then(() => this.#route());
        } else if (this.screen === "loading") this.#route();
      });
    });
  }

  #counted(): boolean {
    return this.me?.answer === "yes" || this.#pending !== null;
  }

  /** Picks the screen from the state and this person's own answer. */
  #route(): void {
    const v = this.view;
    if (!v) return;
    const me = this.me;
    const yes = me?.answer === "yes";
    if (v.state === "gone") {
      this.screen = v.ended === "thanks_for_coming" ? "outside" : "gone";
      return;
    }
    if (v.kind === "plan") {
      if (v.state === "kindling") this.screen = yes && !this.takenBack ? "in" : "plan-invite";
      else this.screen = yes || me?.in_set ? "plan-lit" : "plan-invite";
      return;
    }
    if (v.state === "kindling") this.screen = yes && !this.takenBack ? "in" : "invite";
    else if (v.state === "ember") this.screen = "ember";
    else if (me?.arrived) this.screen = "here";
    else this.screen = yes || me?.in_set || me?.answer === "cant_make_it" ? "lit" : "invite";
  }

  // ---------- answering ----------

  /** "I'm in": straight to the read-back-free yes, or the join step first for a new phone. */
  yes(rules: Rule[] = [], emberOnly = false): void {
    this.error = "";
    this.#pending = { rules, emberOnly };
    if (!this.#group) {
      this.screen = "join";
      return;
    }
    const fails = this.#needFails();
    if (!emberOnly && fails.length && this.view?.kind === "flare") {
      this.notSuit = fails;
      this.screen = "not-suit";
      return;
    }
    void this.#sendYes();
  }

  /** I5: count me in for a closer one; only the Ember-only flag is sent (BR-A-3). */
  closerOne(): void {
    const p = this.#pending ?? { rules: [], emberOnly: false };
    this.#pending = { ...p, emberOnly: true };
    void this.#sendYes();
  }
  notNow(): void {
    this.#pending = null;
    this.#route();
  }

  async join(name: string): Promise<void> {
    const d = this.#d;
    const key = this.#key;
    const v = this.view;
    if (!key || !v) return;
    this.busy = true;
    const memberId = crypto.randomUUID();
    const token = newToken();
    const nameCt = await d.crypto.seal(key, `m:${v.group_id}:${memberId}`, utf8(name));
    const r = await write<Member>(d, "POST", `/groups/${v.group_id}/members`, {
      id: memberId,
      name_ct: nameCt,
      write_token: token,
    });
    this.busy = false;
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      return;
    }
    const g: ClientIcd.GroupRecord = { groupId: v.group_id, key, memberId, token, names: { [memberId]: name } };
    await d.store.saveGroup(g);
    this.#group = g;
    rememberName(name);
    await this.#remember();
    const p = this.#pending ?? { rules: [], emberOnly: false };
    this.yes(p.rules, p.emberOnly);
  }

  async #sendYes(): Promise<void> {
    const g = this.#group;
    const p = this.#pending ?? { rules: [], emberOnly: false };
    if (!g) return;
    const before = this.screen;
    // Optimistic (SRS-RES-3): You're in shows now, the server confirms after.
    this.takenBack = false;
    this.me = this.me ? { ...this.me, answer: "yes", rules: p.rules, ember_only: p.emberOnly } : null;
    this.screen = this.view?.state === "ember" ? "ember" : this.view?.state === "lit" ? "lit" : "in";
    feedback("yes");
    const body: AnswerBody = { answer: "yes", rules: p.rules, ember_only: p.emberOnly };
    const checks = this.#checks();
    if (checks) body.checks = { results: checks };
    const r = await write<Me>(this.#d, "PUT", `/gatherings/${this.#id}/me`, body);
    this.#pending = null;
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      if (r.code === "gone" || r.code === "not_found") this.screen = "gone";
      else this.screen = before === "readback" ? "invite" : before;
      await this.#loadMe();
      return;
    }
    this.queued = r.value === null;
    if (r.value) this.me = r.value;
  }

  async takeBack(): Promise<void> {
    const g = this.#group;
    if (!g) return;
    this.takenBack = true;
    const r = await write<Me>(this.#d, "DELETE", `/gatherings/${this.#id}/me`);
    if (!r.ok) {
      this.takenBack = false;
      this.error = t(errorKey(r.code));
      return;
    }
    if (r.value) this.me = r.value;
  }

  /** After Lit: "Can't make it" (SRS-RES-6). Does not change the state. */
  async cantMakeIt(): Promise<void> {
    const r = await write<Me>(this.#d, "PUT", `/gatherings/${this.#id}/me`, { answer: "cant_make_it" });
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      return;
    }
    this.me = r.value ?? (this.me ? { ...this.me, answer: "cant_make_it" } : null);
  }

  // ---------- conditions (I2, I3) ----------

  startCondition(): void {
    this.condError = "";
    this.screen = "condition";
  }

  check(text: string): void {
    const c = this.#d.conditions;
    if (!c || !this.view) return;
    const steps = this.view.plan?.steps.map((s) => ({ step: s.step, name: this.stepName(s.step) }));
    const res = c.parse(text, {
      members: Object.entries(this.#names).map(([id, name]) => ({ id, name })),
      tz: this.#d.tz,
      now: new Date(this.serverNow).toISOString(),
      kind: this.view.kind,
      steps,
    });
    if (!res.ok) {
      this.condError =
        res.reason === "not_in_group"
          ? t("cond.notInGroup", { name: res.name ?? "" })
          : res.reason === "too_many"
            ? t("cond.tooMany")
            : t("cond.didntCatch");
      return;
    }
    this.#parsed = res.rules;
    this.readBack = res.readBack;
    this.chips = res.rules.map((r) => ruleChip(r, this.#d.tz, this.#names));
    this.screen = "readback";
  }

  confirmReadBack(): void {
    this.yes(this.#parsed, false);
  }

  fix(): void {
    this.screen = "condition";
  }

  // ---------- Lit, compass, arrival, Spark ----------

  find(): void {
    this.screen = "compass";
  }
  backToLit(): void {
    this.#route();
  }

  setPosition(p: LatLon | null): void {
    this.#position = p;
    const s = this.sealed;
    if (p && s && this.#d.maps) this.walkMin = Math.round(this.#d.maps.walkMinutes(p, s.spot));
  }

  async here(): Promise<void> {
    this.busy = true;
    const body = { for: "self", recorded_at: new Date(this.serverNow).toISOString() };
    const r = await write<ArrivalResult>(this.#d, "POST", `/gatherings/${this.#id}/arrivals`, body);
    this.busy = false;
    if (!r.ok) {
      this.error = t(errorKey(r.code));
      return;
    }
    if (r.value) {
      await this.#apply(r.value.gathering);
      this.sparkTicket = r.value.spark_ticket ?? null;
    }
    this.hereCount = Math.max(1, this.view?.headcount ?? 1);
    this.me = this.me ? { ...this.me, arrived: true } : null;
    this.screen = "here";
  }

  /** After I8: offer the Spark once when the arrival counted (BR-K-1). */
  afterHere(): void {
    this.screen = this.sparkTicket ? "spark" : "outside";
  }

  async saveSpark(line: string): Promise<void> {
    const g = this.#group;
    const key = this.#key;
    const ticket = this.sparkTicket;
    const s = this.sealed;
    if (!g || !key || !ticket || !s || !line) return;
    this.busy = true;
    const id = crypto.randomUUID();
    const placeKey =
      this.view?.ember_choice && this.view.ember_choice !== "spot"
        ? s.candidates?.[this.view.ember_choice]?.key
        : s.spot.key;
    const body = {
      id,
      ticket,
      place: await this.#d.crypto.placeHash(key, placeKey ?? s.spot.key),
      text_ct: await this.#d.crypto.seal(key, `s:${g.groupId}:${id}`, utf8(line)),
      delete_token: newToken(),
    };
    const r = await write<unknown>(this.#d, "POST", `/groups/${g.groupId}/sparks`, body);
    this.busy = false;
    if (!r.ok && r.code !== "spark_exists") {
      this.error = t(errorKey(r.code));
      return;
    }
    this.sparkTicket = null;
    this.screen = "spark-saved";
  }

  skipSpark(): void {
    this.sparkTicket = null;
    this.screen = "outside";
  }

  // ---------- Plans (P4 to P6) ----------

  /** "Short one only": a yes for the smallest step only (min_step 4, ADR-0016). */
  shortOnly(): void {
    this.yes([{ type: "min_step", step: 4 }], false);
  }

  askFade(): void {
    this.error = "";
    this.screen = "fade";
  }

  async fade(): Promise<boolean> {
    this.busy = true;
    const r = await write<GatheringView>(this.#d, "POST", `/gatherings/${this.#id}/fade`);
    this.busy = false;
    if (!r.ok) {
      this.error = t(errorKey(r.code as FailCode));
      return false;
    }
    if (r.value) await this.#apply(r.value);
    this.me = this.me ? { ...this.me, can_fade: false } : null;
    return true;
  }

  // ---------- needs (BR-A-2, BR-C-7) ----------

  #needs: Needs | null = null;
  async loadNeeds(): Promise<void> {
    try {
      this.#needs = await this.#d.store.needs<Needs>();
    } catch {
      this.#needs = null;
    }
  }

  #pack: Parameters<NonNullable<Deps["maps"]>["checkNeeds"]>[0] | null = null;
  async loadPack(area: string): Promise<void> {
    const m = this.#d.maps;
    if (!m) return;
    try {
      this.#pack = await m.load(area);
    } catch {
      this.#pack = null;
    }
  }

  /** Pass/fail per label from this phone's needs and walk limit (BR-C-7, BR-E-3). */
  #checks(): Partial<Record<Label, boolean>> | null {
    const m = this.#d.maps;
    const s = this.sealed;
    if (!m || !s || !this.#pack || !this.#needs) return null;
    const out: Partial<Record<Label, boolean>> = {
      spot: m.checkNeeds(this.#pack, this.#needs, this.#position, s.spot),
    };
    for (const [label, place] of Object.entries(s.candidates ?? {})) {
      out[label as Label] = m.checkNeeds(this.#pack, this.#needs, this.#position, place);
    }
    return out;
  }

  /** Reasons the spot fails this person's needs, for I5. Empty when it suits or no needs are set. */
  #needFails(): { icon: string; text: string }[] {
    const m = this.#d.maps;
    const s = this.sealed;
    const n = this.#needs;
    if (!m || !s || !this.#pack || !n) return [];
    if (m.checkNeeds(this.#pack, n, this.#position, s.spot)) return [];
    const a = m.accessLine(this.#pack, s.spot);
    const out: { icon: string; text: string }[] = [];
    if (n.avoid_steps && a.steps_mapped) out.push({ icon: "steps", text: t("notSuit.steps") });
    if (n.rest_gap_m !== null && a.benches.nearest_m !== null && a.benches.nearest_m > n.rest_gap_m)
      out.push({ icon: "bench", text: t("notSuit.bench", { m: a.benches.nearest_m }) });
    if (n.restroom_300m && (a.restrooms.nearest_m === null || a.restrooms.nearest_m > 300))
      out.push({ icon: "restroom", text: t("notSuit.restroom") });
    return out;
  }
}

/** The first name typed last time, to prefill I0 on this phone only. */
export function rememberedName(): string {
  try {
    return localStorage.getItem("flare.name") ?? "";
  } catch {
    return "";
  }
}
function rememberName(name: string): void {
  try {
    localStorage.setItem("flare.name", name);
  } catch {
    // Private mode: nothing remembered.
  }
}
