<!-- "Try it on your photo" (brief item 4), on the live drafts path like /hello: the photo is
     shrunk to a 768 px JPEG here, sent once to POST /api/v1/drafts, and develops like a print
     while Gemma writes six words on our laptop. Nothing is stored (the server keeps the photo in
     memory only). Hub off (tier "rules"): the template comes back and the visitor can type; cloud
     only after a tap, and only when /api/v1/config says this server offers it. -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { DraftResponse, MAX_PHOTO_BYTES, type DraftResponseT } from "@flare/shared";
  import PhotoPrint from "#lib/components/PhotoPrint.svelte";
  import { t } from "#lib/copy/site.ts";
  import { toJpeg768 } from "#lib/photo.ts";
  import { cloudPhotoOffered } from "./live.ts";

  let src = $state("");
  let jpeg: Blob | null = null;
  let busy = $state(false);
  let result: DraftResponseT | null = $state(null);
  let typed = $state("");
  let error = $state("");
  let cloudOk = $state(false);

  const secs = (ms: number) => (ms / 1000).toFixed(1);

  async function send(cloud: boolean) {
    if (!jpeg) return;
    busy = true;
    error = "";
    try {
      const res = await fetch(cloud ? "/api/v1/drafts?cloud=1" : "/api/v1/drafts", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: jpeg,
      });
      if (res.status === 429) throw new Error("busy");
      if (res.status === 413) throw new Error("big");
      if (!res.ok) throw new Error("fail");
      result = DraftResponse.parse(await res.json());
      typed = result.invite;
      if (result.tier === "rules") cloudOk = await cloudPhotoOffered(fetch);
    } catch (e) {
      const m = (e as Error).message;
      error = m === "busy" ? t("site.try.busy") : m === "big" ? t("site.try.big") : t("site.try.fail");
    } finally {
      busy = false;
    }
  }

  async function pick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (src) URL.revokeObjectURL(src);
    result = null;
    error = "";
    cloudOk = false;
    try {
      jpeg = await toJpeg768(file);
    } catch {
      error = t("site.try.fail");
      return;
    }
    if (jpeg.size > MAX_PHOTO_BYTES) {
      error = t("site.try.big");
      return;
    }
    src = URL.createObjectURL(jpeg);
    await send(false);
  }

  onDestroy(() => {
    if (src) URL.revokeObjectURL(src);
  });

  const printState = $derived(src && busy && !result ? "developing" : "developed");
</script>

<h2 class="t-title">{t("site.try.title")}</h2>
<p class="lead">{t("site.try.lead")}</p>

<div class="try">
  <div class="print-box">
    <PhotoPrint state={printState} {src} scene={src ? result?.alt || t("site.try.photo") : ""} height={300} tilt={-2} sample={!src} />
  </div>
  <div class="side">
    <label class="pick" class:busy>
      <input type="file" accept="image/*" onchange={pick} disabled={busy} />
      <span>{src ? t("site.try.again") : t("site.try.pick")}</span>
    </label>
    <p class="small">{t("site.try.rules")}</p>

    <div class="out" aria-live="polite">
      {#if busy}
        <p class="status">{t("site.try.working")}</p>
      {:else if error}
        <p class="status err">{error}</p>
      {:else if result && result.tier !== "rules"}
        <p class="words">{result.invite}</p>
        <p class="status">{result.tier === "hub" ? t("site.try.hub", { s: secs(result.ms) }) : t("site.try.cloudDone", { s: secs(result.ms) })}</p>
        {#if result.alt}<p class="small"><b>{t("site.try.altLabel")}:</b> {result.alt}</p>{/if}
      {:else if result}
        <p class="status">{t("site.try.off")}</p>
        <label class="type">
          <span>{t("site.try.typeLabel")}</span>
          <input type="text" bind:value={typed} maxlength="60" autocomplete="off" />
        </label>
        {#if cloudOk}
          <button type="button" class="cloud" onclick={() => send(true)}>{t("site.try.cloud")}</button>
          <p class="small">{t("site.try.cloudNote")}</p>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .lead { margin: 0; }
  .try { display: grid; gap: 22px; align-items: center; }
  .print-box { width: min(260px, 72vw); justify-self: center; }
  .side { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  .pick { position: relative; display: inline-flex; align-items: center; min-height: 52px; padding: 0 24px; border-radius: 999px; background: var(--c-maple-700);
    color: var(--c-birch-50); font-weight: 700; cursor: pointer; }
  .pick:focus-within { outline: 3px solid var(--c-gold-400); outline-offset: 3px; }
  .pick.busy { opacity: 0.7; cursor: progress; }
  .pick input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .small { margin: 0; font-size: 0.95rem; color: var(--text-muted); max-width: 40ch; }
  .out { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; min-height: 3em; }
  .out p { margin: 0; }
  .words { font-family: var(--font-display, serif); font-size: 1.9rem; line-height: 1.15; font-weight: 600; }
  .status { font-weight: 700; }
  .err { color: var(--accent-text); }
  .type { display: flex; flex-direction: column; gap: 4px; font-weight: 700; width: 100%; max-width: 360px; }
  .type input { min-height: 48px; padding: 0 12px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--text); font: inherit; font-weight: 400; }
  .cloud { min-height: 48px; padding: 0 20px; border-radius: 999px; border: 2px solid var(--c-maple-700); background: transparent; color: var(--accent-text); font: inherit; font-weight: 700; cursor: pointer; }
  @media (min-width: 900px) {
    .try { grid-template-columns: 300px 1fr; gap: 40px; }
  }
</style>
