<!-- O6 Fix the map (SRS-MAP-1 to -4): pick what's missing, take a photo, our laptop drafts the
     tags (ICR-ML5, POST /api/v1/drafts/tags), the person checks every tag, then exports a note or
     an .osm file. The photo is zeroed after the draft and is never in an export. Nothing is sent
     to OpenStreetMap; the person posts the export themselves. No photo or no hub: the usual tags. -->
<script lang="ts">
  import Screen from "#lib/components/Screen.svelte";
  import Button from "#lib/components/Button.svelte";
  import Choice from "#lib/components/Choice.svelte";
  import TextField from "#lib/components/TextField.svelte";
  import { t } from "#lib/copy/index.ts";
  import { askLocation } from "#lib/permissions/index.ts";
  import { toJpeg768 } from "#lib/photo.ts";
  import { fixmap } from "#lib/map/index.ts";
  import type { AllowKey, Review, Thing } from "#lib/map/fixmap.ts";
  import { back } from "../back.ts";

  const THINGS: Thing[] = ["bench", "toilets", "drinking_water", "steps"];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const options = THINGS.map((v) => ({ value: v, label: cap(t(`map.thing.${v}`)) }));

  let thing = $state("");
  let error = $state("");
  let status = $state("");
  let locating = $state(false);
  let drafting = $state(false);
  let source = $state<"photo" | "none" | "failed">("none");
  let input: HTMLInputElement | undefined = $state();
  let review = $state<Review | null>(null);
  let editing = $state<AllowKey | null>(null);
  let draft = $state("");
  let fieldError = $state("");

  /** Ask the hub for tags. Empty on any failure; the thing's own amenity is the person's choice. */
  async function ask(jpeg: Uint8Array): Promise<unknown> {
    const res = await fetch("/api/v1/drafts/tags", {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: jpeg as BodyInit,
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { tags?: Record<string, string> };
    const { amenity: _, ...rest } = body.tags ?? {};
    return rest;
  }

  async function start(photo: File | null) {
    error = "";
    locating = true;
    const at = await askLocation({ timeoutMs: 15_000 });
    locating = false;
    if (!at.ok) {
      error = t("map.noLocation");
      return;
    }
    const th = thing as Thing;
    let tags = fixmap.STARTER[th];
    source = "none";
    if (photo) {
      drafting = true;
      const jpeg = new Uint8Array(await (await toJpeg768(photo).catch(() => photo)).arrayBuffer());
      const drafted = await fixmap.draftFromPhoto(jpeg, ask); // zero-fills jpeg (SRS-MAP-4)
      drafting = false;
      source = drafted.length ? "photo" : "failed";
      if (drafted.length) tags = drafted;
    }
    review = fixmap.startReview(th, { lat: at.coords.lat, lon: at.coords.lon }, tags);
  }

  function picked(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
    (e.currentTarget as HTMLInputElement).value = "";
    if (f) start(f);
  }

  function edit(key: AllowKey, value: string) {
    editing = key;
    draft = value;
    fieldError = "";
  }
  function save() {
    if (!review || !editing) return;
    try {
      review = fixmap.change(review, editing, draft);
      editing = null;
    } catch {
      fieldError = t("map.badValue", { key: editing ?? "" });
    }
  }

  function file(name: string, body: string, type: string) {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function exportNote() {
    if (!review) return;
    const n = fixmap.noteExport(review);
    const text = `${n.text}\n${n.lat}, ${n.lon}`;
    try {
      await navigator.clipboard.writeText(text);
      status = t("map.copied");
    } catch {
      file("flare-map-note.txt", text, "text/plain");
    }
  }
  function exportOsm() {
    if (review) file("flare-map-fix.osm", fixmap.osmExport(review), "application/xml");
  }

  const left = $derived(review ? fixmap.left(review) : 0);
  const ready = $derived(review ? fixmap.canExport(review) : false);
</script>

<svelte:head><title>{t("map.title")}</title></svelte:head>

<Screen heading={t("map.title")} title={t("map.title")} onclose={back}>
  {#if !review}
    <Choice label={t("map.pick")} bind:value={thing} {options} />
    <p class="t-small t-muted">{t("map.photoAsk")}</p>
    <input bind:this={input} class="file" type="file" accept="image/*" capture="environment" onchange={picked} tabindex="-1" aria-hidden="true" />
    {#if drafting}<p class="t-muted" role="status">{t("map.drafting")}</p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {:else}
    {#if source === "photo"}<p class="t-small" role="status">{t("map.photoGone")}</p>{/if}
    <p class="t-small t-muted">
      {source === "photo" ? t("map.drafted") : source === "failed" ? t("map.noDraft") : t("map.starter")}
      {t("map.review")}
    </p>
    <ul class="tags">
      {#each review.tags as tag (tag.key)}
        <li>
          <div class="row">
            <code>{tag.key}={tag.value}</code>
            <div class="acts" role="group" aria-label={t("map.groupAria", { key: tag.key })}>
              <button type="button" aria-pressed={tag.status === "keep"} onclick={() => review && (review = fixmap.keep(review, tag.key))}>{t("map.keep")}</button>
              <button type="button" aria-pressed={tag.status === "change"} onclick={() => edit(tag.key, tag.value)}>{t("map.change")}</button>
              <button type="button" aria-pressed={tag.status === "remove"} onclick={() => review && (review = fixmap.remove(review, tag.key))}>{t("map.remove")}</button>
            </div>
          </div>
          {#if editing === tag.key}
            <div class="edit">
              <TextField label={t("map.changeLabel", { key: tag.key })} bind:value={draft} error={fieldError} max={80} />
              <Button variant="secondary" onclick={save}>{t("map.save")}</Button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if status}<p role="status">{status}</p>{/if}
  {/if}
  {#snippet actions()}
    {#if !review}
      <Button icon="camera" onclick={() => input?.click()} disabled={!thing} loading={locating || drafting}>{t("camera.shutter")}</Button>
      <Button variant="text" onclick={() => start(null)} disabled={!thing || locating || drafting}>{t("map.noPhoto")}</Button>
    {:else}
      <Button onclick={exportNote} disabled={!ready}>{t("map.export")}</Button>
      <Button variant="text" onclick={exportOsm} disabled={!ready}>{t("map.exportFile")}</Button>
      <p class="t-small t-muted center" aria-live="polite">{ready ? t("map.ready") : t("map.left", { n: left })}</p>
    {/if}
  {/snippet}
</Screen>

<style>
  p { margin: 0; }
  .center { text-align: center; }
  .tags { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  li { padding: 8px 8px 8px 12px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  code { font-weight: 700; font-size: 1rem; }
  .acts { display: flex; gap: 4px; }
  .acts button { min-height: 44px; padding: 0 10px; border-radius: var(--r-pill); border: 2px solid var(--line); background: transparent; color: var(--text); font-weight: 700; font-size: 0.85rem; }
  .acts button[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
  .edit { display: flex; flex-direction: column; gap: 8px; }
  .file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
