<!-- The count, made visual (2026 direction): a ring of segments around the flame, one per
     person needed, filled per yes; one short line ("Need 1 more"); "Nobody sees who" as
     a tiny hint. The flame grows with each yes like the app's Kindling.
     A yes arrives as a spark: it flies in from the screen's edge (a random side, never a name or
     a face), feeds the flame, then the flame grows a step and the count ticks (about 900 ms).
     Reduced motion: the count and the flame change at once. -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import { untrack } from "svelte";
  import { reducedMotion } from "#lib/motion/core.ts";
  import Flame from "./Flame.svelte";
  let { have = 1, quorum = 2, lit = false, size = 88 }: { have?: number; quorum?: number; lit?: boolean; size?: number } = $props();
  // What the ring shows; it trails `have` while a spark is in the air.
  let shown = $state(untrack(() => have));
  let fed = $state(false);
  let ringEl: HTMLDivElement;
  let seed = 0;
  $effect(() => {
    const h = have;
    const prev = untrack(() => shown);
    if (h <= prev || !ringEl || reducedMotion(ringEl)) { shown = h; return; }
    let live = true;
    // The spark lands (#lib/motion/spark.ts, loaded on the first yes), the flame takes it, the count ticks.
    import("#lib/motion/spark.ts")
      .then((m) => m.fly(ringEl, h - prev, seed++))
      .catch(() => {})
      .then(() => {
        if (!live) return;
        fed = true;
        shown = h;
        setTimeout(() => (fed = false), 480);
      });
    return () => { live = false; shown = h; };
  });
  const need = $derived(Math.max(0, quorum - shown));
  const big = $derived(size >= 140);
  const R = 44;
  const C = 2 * Math.PI * R;
  const gap = $derived(quorum > 1 ? 6 : 0);
  const seg = $derived(C / quorum - gap);
</script>

<div class="count" class:big role="status" aria-live="polite">
  <div class="ring" bind:this={ringEl} aria-hidden="true" style:width="{size}px" style:height="{size}px">
    <svg viewBox="0 0 100 100">
      {#each Array.from({ length: quorum }, (_, i) => i) as i}
        <circle cx="50" cy="50" r={R} class="seg" class:on={lit || i < shown} class:new={!lit && i === shown - 1 && fed}
          stroke-dasharray="{seg} {C - seg}" stroke-dashoffset={-(i * (C / quorum)) + C / 4} />
      {/each}
    </svg>
    <span class="flame" class:fed><Flame state={lit ? "lit" : "kindling"} progress={shown / Math.max(1, quorum)} size={Math.round(size * 0.62)} /></span>
  </div>
  <div class="words">
    {#key need}<p class="line" class:tick={fed}>{lit ? t("need.lit") : t("need.toLight", { n: need })}</p>{/key}
    <p class="hint">{t("need.private")}</p>
  </div>
</div>

<style>
  .count { display: flex; align-items: center; gap: 14px; }
  .ring { position: relative; flex: none; }
  .big { flex-direction: column; align-items: flex-start; gap: 10px; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .seg { fill: none; stroke: rgb(255 255 255 / 0.22); stroke-width: 7; stroke-linecap: round; transition: stroke var(--dur-base) var(--ease-out); }
  .seg.on { stroke: var(--c-gold-400); }
  .seg.new { animation: seg-in var(--dur-slow) var(--ease-out); }
  .flame { position: absolute; inset: 0; display: grid; place-items: center; }
  .flame.fed { animation: fed var(--dur-slow) var(--ease-spring); }
  .words p { margin: 0; }
  .line { font-weight: 700; font-size: calc(1.25rem * var(--text-scale)); }
  .line.tick { animation: tick var(--dur-base) var(--ease-out); }
  .hint { font-size: calc(var(--t-small-size) * var(--text-scale)); opacity: 0.8; }
  @keyframes fed { 0% { transform: scale(1); filter: brightness(1); } 40% { transform: scale(1.12); filter: brightness(1.35); } 100% { transform: scale(1); filter: brightness(1); } }
  @keyframes seg-in { from { stroke: #fff6d8; stroke-width: 11; } }
  @keyframes tick { from { transform: translateY(0.4em); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .seg { transition: none; } .flame.fed, .line.tick, .seg.new { animation: none; } }
  :global([data-reduce-motion]) .flame.fed, :global([data-reduce-motion]) .line.tick { animation: none; }
</style>
