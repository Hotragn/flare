<!-- O6 Fix the map: AI-drafted OSM tags, a person reviews every one, export only (FR-MAP-*). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import type { Theme } from "../components/parts";
  let { view = "review", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const tags = $derived<[string, string, string][]>([["amenity", "bench", "keep"], ["backrest", "yes", "keep"], ["material", "wood", view === "ready" ? "keep" : ""], ["seats", "3", view === "ready" ? "change" : ""]]);
  const reviewed = $derived(tags.every((t) => t[2]));
</script>

<Screen {theme} {wire} heading="Fix the map" title="Fix the map">
  <PhotoPrint state={view === "drafting" ? "developing" : "developed"} scene="A wooden bench with a backrest by a path." height={190} tilt={-1.5} />
  {#if view === "drafting"}
    <p class="t-muted" role="status">Drafting tags on our laptop…</p>
  {:else}
    <p class="t-small t-muted">Check every tag. Nothing goes to OpenStreetMap from here.</p>
    <ul class="tags">
      {#each tags as [k, v, s]}
        <li>
          <code>{k}={v}</code>
          <div class="acts" role="group" aria-label="Review {k}">
            <button aria-pressed={s === "keep"}>Keep</button><button aria-pressed={s === "change"}>Change</button><button aria-pressed={s === "remove"}>Remove</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet actions()}
    <Button disabled={!reviewed || view === "drafting"}>Export note</Button>
    <p class="t-small t-muted center">{reviewed ? "Ready. You choose where to post it." : `${tags.filter((t) => !t[2]).length} tags left to check`}</p>
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
