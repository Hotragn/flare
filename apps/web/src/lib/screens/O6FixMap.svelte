<!-- O6 Fix the map: AI-drafted OSM tags, a person reviews every one, export only (FR-MAP-*). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let { view = "review", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const tags = $derived<[string, string, string][]>([["amenity", "bench", "keep"], ["backrest", "yes", "keep"], ["material", "wood", view === "ready" ? "keep" : ""], ["seats", "3", view === "ready" ? "change" : ""]]);
  const reviewed = $derived(tags.every((tag) => tag[2]));
  const left = $derived(tags.filter((tag) => !tag[2]).length);
</script>

<Screen {theme} {wire} heading={t("map.title")} title={t("map.title")}>
  <PhotoPrint state={view === "drafting" ? "developing" : "developed"} scene={t("map.scene")} height={190} tilt={-1.5} />
  {#if view === "drafting"}
    <p class="t-muted" role="status">{t("map.drafting")}</p>
  {:else}
    <p class="t-small t-muted">{t("map.review")}</p>
    <ul class="tags">
      {#each tags as [k, v, s]}
        <li>
          <code>{k}={v}</code>
          <div class="acts" role="group" aria-label={t("map.groupAria", { key: k })}>
            <button aria-pressed={s === "keep"}>{t("map.keep")}</button><button aria-pressed={s === "change"}>{t("map.change")}</button><button aria-pressed={s === "remove"}>{t("map.remove")}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet actions()}
    <Button disabled={!reviewed || view === "drafting"}>{t("map.export")}</Button>
    <p class="t-small t-muted center">{reviewed ? t("map.ready") : t("map.left", { n: left })}</p>
  {/snippet}
</Screen>

<style>
  p { margin: 0; }
  .center { text-align: center; }
  .tags { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line); }
  code { font-weight: 700; font-size: 1rem; }
  .acts { display: flex; gap: 4px; }
  .acts button { min-height: 44px; padding: 0 10px; border-radius: var(--r-pill); border: 2px solid var(--line); background: transparent; font-weight: 700; font-size: 0.85rem; }
  .acts button[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
</style>
