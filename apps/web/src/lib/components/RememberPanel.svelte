<!-- Remember this (ADR-0031): a conversation note made only with everyone's consent.
     Off by default; the host turns it on for this Flare; each person agrees on their own phone;
     any no or late joiner keeps it off for everyone, and the screen never says who. When lit and
     everyone agreed, anyone records up to 60 s; every phone shows the sign live and anyone can
     stop it. The words come back from ElevenLabs Scribe with speaker labels only, Gemma on our
     laptop writes one line (none when it's off; never the cloud), and the note is sealed here with
     the Flare key before it is stored. Deleted with the Flare. -->
<script lang="ts">
  import { onMount } from "svelte";
  import Button from "./Button.svelte";
  import Sheet from "./Sheet.svelte";
  import Icon from "./Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import { startSpark, type Recording } from "#lib/voice/spark.ts";
  type Ctx = { id: string; auth: string; key: CryptoKey; crypto: { sealJson(k: CryptoKey, aad: `r:${string}`, v: unknown): Promise<string>; open(k: CryptoKey, aad: `r:${string}`, s: string): Promise<Uint8Array> } };
  type State = { on: boolean; ready: boolean; recording: boolean; recording_until: string | null; has_note: boolean; my_ok?: boolean | null; is_host?: boolean; note_ct?: string | null };
  type Note = { v: 1; lines: { speaker: string; text: string }[]; summary: string | null };
  let { ctx, lit = false, onspark }: { ctx: Ctx; lit?: boolean; onspark?: (line: string) => void } = $props();

  const base = $derived(`/api/v1/gatherings/${ctx.id}/remember`);
  let st = $state<State | null>(null);
  let open = $state(false);
  let error = $state("");
  let working = $state(false);
  let note = $state<Note | null>(null);
  let now = $state(Date.now());
  let rec: Recording | null = null;
  let mine = false; // this phone is the one recording

  const call = async (path: string, method: string, body?: unknown, type = "application/json") => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { authorization: ctx.auth, ...(body !== undefined ? { "content-type": type } : {}) },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  async function load() {
    try {
      const s = (await call("", "GET")) as State;
      st = s;
      if (s.note_ct) note = JSON.parse(new TextDecoder().decode(await ctx.crypto.open(ctx.key, `r:${ctx.id}`, s.note_ct))) as Note;
    } catch {
      // gone or offline: the panel stays quiet
    }
  }
  function apply(s: State) {
    const hadNote = st?.has_note;
    st = { ...st, ...s };
    if (!s.recording && mine) rec?.stop(); // someone stopped it for everyone, or a no came in
    if (s.has_note && !hadNote) void load();
  }
  onMount(() => {
    void load();
    const es = new EventSource(`/api/v1/gatherings/${ctx.id}/events`);
    es.addEventListener("remember", (e) => apply(JSON.parse((e as MessageEvent).data) as State));
    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => {
      es.close();
      clearInterval(tick);
      rec?.stop();
    };
  });

  const left = $derived(st?.recording_until ? Math.max(0, Math.ceil((Date.parse(st.recording_until) - now) / 1000)) : 0);
  async function setOn(on: boolean) {
    error = "";
    st = { ...(st as State), ...((await call("", "PUT", { on })) as State), my_ok: on };
  }
  async function consent(ok: boolean) {
    st = { ...(st as State), ...((await call("/consent", "PUT", { ok })) as State), my_ok: ok };
  }
  async function record() {
    error = "";
    try {
      rec = await startSpark(60_000);
    } catch {
      error = t("remember.failed");
      return;
    }
    mine = true;
    try {
      apply((await call("/record", "POST", { action: "start" })) as State);
    } catch {
      rec.stop();
      mine = false;
      error = t("remember.off");
      return;
    }
    open = false;
    const clip = await rec.done;
    rec = null;
    mine = false;
    await call("/record", "POST", { action: "stop" }).catch(() => {});
    if (!clip) return;
    working = true;
    try {
      const { lines } = (await call("/transcribe", "POST", clip, clip.type)) as { lines: Note["lines"] | null };
      if (!lines?.length) throw new Error("empty");
      const text = lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
      const { line } = (await call("/summary", "POST", { text }).catch(() => ({ line: null }))) as { line: string | null };
      const n: Note = { v: 1, lines, summary: line };
      await call("/note", "PUT", { note_ct: await ctx.crypto.sealJson(ctx.key, `r:${ctx.id}`, n) });
      note = n;
    } catch {
      error = t("remember.failed");
    } finally {
      working = false;
    }
  }
  const stop = () => void call("/record", "POST", { action: "stop" }).then((s) => apply(s as State)).catch(() => {});
</script>

{#if st?.recording}
  <!-- On every phone, live: the sign and a stop anyone can tap. -->
  <div class="rec" role="status" aria-live="assertive">
    <span class="dot" aria-hidden="true"></span><b>{t("remember.recording", { s: left })}</b>
    <button class="stop" onclick={stop}>{t("remember.stop")}</button>
  </div>
{/if}

{#if st && (st.is_host || st.on || note)}
  <button class="chip" onclick={() => (open = true)} aria-haspopup="dialog">
    <Icon name="mic" size={18} /><span>{working ? t("remember.working") : t("remember.chip")}</span>
  </button>
{/if}

<Sheet bind:open title={note ? t("remember.noteTitle") : t("remember.title")}>
  {#if note}
    {#if note.summary}<p class="summary">{note.summary}</p>{:else}<p class="t-small t-muted">{t("remember.noSummary")}</p>{/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard scroll, axe scrollable-region-focusable) -->
    <ul class="lines" tabindex="0">{#each note.lines as l}<li><b>{l.speaker}</b> {l.text}</li>{/each}</ul>
    {#if note.summary && onspark}<Button variant="secondary" icon="spark" onclick={() => onspark?.(note?.summary ?? "")}>{t("remember.saveSpark")}</Button>{/if}
    <p class="t-small t-muted">{t("remember.privacy")}</p>
  {:else if st?.is_host && !st.on}
    <p>{t("remember.hostBody")}</p>
    <Button onclick={() => void setOn(true)}>{t("remember.turnOn")}</Button>
  {:else if st && !st.is_host && st.on && st.my_ok == null}
    <p>{t("remember.askBody")}</p>
    <Button onclick={() => void consent(true)}>{t("remember.agree")}</Button>
    <Button variant="text" onclick={() => void consent(false)}>{t("remember.decline")}</Button>
  {:else if st?.ready && lit}
    <p class="warn"><Icon name="info" size={20} /><span>{t("remember.warn")}</span></p>
    <Button icon="mic" onclick={() => void record()}>{t("remember.record")}</Button>
  {:else if st?.on}
    <p role="status">{st.my_ok === false ? t("remember.off") : lit ? t("remember.waiting") : t("remember.notLit")}</p>
    {#if st.is_host}<Button variant="text" onclick={() => void setOn(false)}>{t("remember.turnOff")}</Button>{/if}
  {/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
</Sheet>

<style>
  .chip { position: fixed; z-index: 35; left: 12px; top: calc(env(safe-area-inset-top, 0) + 64px); min-height: 44px; display: inline-flex; gap: 6px; align-items: center; padding: 0 14px; border: 0; border-radius: 999px; background: rgb(0 0 0 / 0.55); color: #fff; font-weight: 700; }
  .rec { position: fixed; z-index: 60; left: 0; right: 0; top: 0; display: flex; gap: 10px; align-items: center; padding: calc(env(safe-area-inset-top, 0) + 10px) 14px 10px; background: #b3261e; color: #fff; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: #fff; animation: blink 1s steps(2, start) infinite; }
  .stop { margin-left: auto; min-height: 44px; padding: 0 14px; border: 2px solid #fff; border-radius: 999px; background: transparent; color: #fff; font-weight: 800; }
  .summary { margin: 0; font-weight: 700; font-size: 1.125rem; }
  .lines { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; max-height: 40vh; overflow: auto; }
  .warn { display: flex; gap: 8px; align-items: center; margin: 0; font-weight: 700; }
  .err { margin: 0; font-weight: 700; }
  p { margin: 0; }
  @keyframes blink { to { visibility: hidden; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
</style>
