<!-- Scenic photos behind a screen (backlog #6): CC0 / public-domain nature photography
     (docs/credits/photos.md), a slow crossfade with a gentle Ken Burns drift. AVIF with WebP
     fallback, portrait crop on phones, landscape on wide screens; never precached, so offline
     (or before it loads) the illustrated scenery underneath shows. Reduced motion: one still. -->
<script lang="ts">
  import { onMount } from "svelte";
  import Scenery from "./Scenery.svelte";
  let {
    slugs = ["pictured-rocks-cliffs", "acadia-eagle-lake", "sleeping-bear-dunes", "pictured-rocks-autumn", "grand-canyon-sunset", "autumn-trail"],
    everyMs = 8000,
    start = 0,
  }: { slugs?: string[]; everyMs?: number; start?: number } = $props();
  let i = $state(0);
  let failed = $state<Record<string, boolean>>({});
  let still = $state(true);
  onMount(() => {
    i = start % slugs.length;
    still = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-reduce-motion");
    if (still || slugs.length < 2) return;
    const h = setInterval(() => (i = (i + 1) % slugs.length), everyMs);
    return () => clearInterval(h);
  });
  const shown = $derived(still ? [slugs[i % slugs.length] as string] : [slugs[i % slugs.length] as string, slugs[(i + 1) % slugs.length] as string]);
</script>

<div class="scenic" aria-hidden="true">
  <div class="base"><Scenery people={false} /></div>
  {#each slugs as slug, k (slug)}
    {#if !failed[slug] && (k === i % slugs.length || shown.includes(slug))}
      <picture class="ph" class:on={k === i % slugs.length} class:drift={!still} style:--d="{everyMs * 1.4}ms">
        <source type="image/avif" media="(orientation: landscape)" srcset="/scenery/{slug}-l.avif" />
        <source type="image/avif" srcset="/scenery/{slug}-p.avif" />
        <source type="image/webp" media="(orientation: landscape)" srcset="/scenery/{slug}-l.webp" />
        <img src="/scenery/{slug}-p.webp" alt="" decoding="async" loading={k === i % slugs.length ? "eager" : "lazy"} fetchpriority="low"
          onerror={() => (failed = { ...failed, [slug]: true })} />
      </picture>
    {/if}
  {/each}
</div>

<style>
  .scenic { position: absolute; inset: 0; overflow: hidden; background: #1b1410; }
  .base { position: absolute; inset: 0; }
  .base :global(svg) { width: 100%; height: 100%; display: block; }
  .ph { position: absolute; inset: 0; opacity: 0; transition: opacity 1.6s ease-in-out; }
  .ph.on { opacity: 1; }
  .ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph.drift.on img { animation: kenburns var(--d) ease-out both; }
  @keyframes kenburns { from { transform: scale(1.02) translate3d(0, 0, 0); } to { transform: scale(1.1) translate3d(-1.5%, -1%, 0); } }
  @media (prefers-reduced-motion: reduce) { .ph { transition: none; } .ph.drift.on img { animation: none; } }
</style>
