<!-- The count, made visual (2026 direction): a ring of segments around the flame, one per
     person needed, filled per yes; one short line ("1 more to light it"); "Nobody sees who" as
     a tiny hint. The flame grows with each yes like the app's Kindling. -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import Flame from "./Flame.svelte";
  let { have = 1, quorum = 2, lit = false }: { have?: number; quorum?: number; lit?: boolean } = $props();
  const need = $derived(Math.max(0, quorum - have));
  const R = 44;
  const C = 2 * Math.PI * R;
  const gap = $derived(quorum > 1 ? 6 : 0);
  const seg = $derived(C / quorum - gap);
</script>

<div class="count" role="status" aria-live="polite">
  <div class="ring" aria-hidden="true">
    <svg viewBox="0 0 100 100">
      {#each Array.from({ length: quorum }, (_, i) => i) as i}
        <circle cx="50" cy="50" r={R} class="seg" class:on={lit || i < have}
          stroke-dasharray="{seg} {C - seg}" stroke-dashoffset={-(i * (C / quorum)) + C / 4} />
      {/each}
    </svg>
    <span class="flame"><Flame state={lit ? "lit" : "kindling"} progress={have / Math.max(1, quorum)} size={58} /></span>
  </div>
  <div class="words">
    <p class="line">{lit ? t("need.lit") : t("need.toLight", { n: need })}</p>
    <p class="hint">{t("need.private")}</p>
  </div>
</div>

<style>
  .count { display: flex; align-items: center; gap: 14px; }
  .ring { position: relative; width: 88px; height: 88px; flex: none; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .seg { fill: none; stroke: rgb(255 255 255 / 0.22); stroke-width: 7; stroke-linecap: round; transition: stroke var(--dur-base) var(--ease-out); }
  .seg.on { stroke: var(--c-gold-400); }
  .flame { position: absolute; inset: 0; display: grid; place-items: center; }
  .words p { margin: 0; }
  .line { font-weight: 700; font-size: calc(1.25rem * var(--text-scale)); }
  .hint { font-size: calc(var(--t-small-size) * var(--text-scale)); opacity: 0.8; }
  @media (prefers-reduced-motion: reduce) { .seg { transition: none; } }
</style>
