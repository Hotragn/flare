<!-- O6 Fix the map (SRS-MAP-1 to -4): pick what's missing, check every tag, export a note or an
     .osm file. Nothing is sent to OpenStreetMap or to our server; the person posts the export
     themselves. With no photo drafter yet (ML5), the draft is the usual tags for the thing. -->
<script lang="ts">
  import Screen from "#lib/components/Screen.svelte";
  import Button from "#lib/components/Button.svelte";
  import Choice from "#lib/components/Choice.svelte";
  import TextField from "#lib/components/TextField.svelte";
  import { t } from "#lib/copy/index.ts";
  import { askLocation } from "#lib/permissions/index.ts";
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
  let review = $state<Review | null>(null);
  let editing = $state<AllowKey | null>(null);
  let draft = $state("");
  let fieldError = $state("");

  async function start() {
    error = "";
    locating = true;
    const at = await askLocation({ timeoutMs: 15_000 });
    locating = false;
    if (!at.ok) {
      error = t("map.noLocation");
      return;
    }
    const th = thing as Thing;
    review = fixmap.startReview(th, { lat: at.coords.lat, lon: at.coords.lon }, fixmap.STARTER[th]);
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
    {#if error}<p role="alert">{error}</p>{/if}
  {:else}
    <p class="t-small t-muted">{t("map.starter")} {t("map.review")}</p>
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
      <Button onclick={start} disabled={!thing} loading={locating}>{t("map.start")}</Button>
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
</style>
