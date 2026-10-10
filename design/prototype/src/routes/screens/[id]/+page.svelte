<!-- One screen at phone size. Query: ?state=...&theme=light|dark|sun&wire=1&reduce=1
     Used by scripts/export.mjs for hi-fi PNGs and wireframes. -->
<script lang="ts">
  import { page } from "$app/state";
  import { byId } from "#lib/screens/registry.ts";
  let { data } = $props();
  const entry = $derived(byId(data.id));
  const q = $derived(page.url.searchParams);
  const view = $derived(q.get("state") ?? entry?.states[0] ?? "");
  const theme = $derived((q.get("theme") ?? entry?.themes[0] ?? "light") as "light" | "dark" | "sun");
  const wire = $derived(q.get("wire") === "1");
</script>

<div class="phone" data-reduce-motion={q.get("reduce") === "1" || undefined}>
  {#if entry}
    {#await entry.load() then mod}
      <mod.default {view} {theme} {wire} />
    {/await}
  {:else}
    <p>Unknown screen</p>
  {/if}
</div>

<style>
  .phone { width: 390px; height: 844px; position: relative; overflow: hidden; }
  :global(body) { margin: 0; }
</style>
