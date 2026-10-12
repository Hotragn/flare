<!--
  The shrink (motion.md, Ember): the big flame folds down into a small ember, and the ember hops
  to a bench close by (about 1.1 s). Not dead, smaller. With `lit` (a friend said yes to the
  smaller plan) it then catches at the bench: a warm flash, the lit sound, and the path to the
  bench draws itself on the ground before the buttons settle in (another 1.1 s).
  Decorative: the screen's headline says what happened. Loaded on demand (JS budget).
  Reduced motion: the end, still (the ember, or the small flame, at the bench; path drawn).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Flame from "./Flame.svelte";
  import { reducedMotion } from "#lib/motion/core.ts";
  import { playWhenReady } from "#lib/motion/sound.ts";
  let { lit = false }: { lit?: boolean } = $props();
  let el: HTMLDivElement;
  onMount(() => {
    if (!lit) return;
    if (reducedMotion(el)) return;
    const h = setTimeout(() => void playWhenReady("lit"), 1100);
    return () => clearTimeout(h);
  });
</script>

<div class="shrink" class:lit bind:this={el} aria-hidden="true">
  <svg class="ground" viewBox="0 0 300 60" preserveAspectRatio="none">
    <ellipse cx="222" cy="52" rx="70" ry="9" class="pool" />
    {#if lit}
      <path class="trail glow" d="M-4 62 C40 56 70 40 120 46 S 190 58 214 52" pathLength="1" />
      <path class="trail" d="M-4 62 C40 56 70 40 120 46 S 190 58 214 52" pathLength="1" />
    {/if}
  </svg>
  <svg class="bench" viewBox="0 0 100 50">
    <rect x="6" y="8" width="88" height="7" rx="3" /><rect x="6" y="22" width="88" height="7" rx="3" />
    <rect x="13" y="28" width="6" height="20" /><rect x="81" y="28" width="6" height="20" />
    <rect x="13" y="12" width="5" height="12" /><rect x="82" y="12" width="5" height="12" />
    <rect x="6" y="8" width="88" height="2" rx="1" class="edge" /><rect x="6" y="22" width="88" height="2" rx="1" class="edge" />
  </svg>
  <div class="big"><Flame state="lit" size={112} mode="css" animate={false} /></div>
  <div class="mover"><div class="hop">
    <span class="ember"><Flame state="ember" size={54} mode="css" animate={false} /></span>
    {#if lit}<span class="small"><Flame state="lit" size={58} mode="css" /></span>{/if}
  </div></div>
  {#if lit}<div class="flash"></div>{/if}
</div>

<style>
  /* A fixed 300 x 170 stage, so the hop is the same on every phone. */
  .shrink { position: relative; width: 300px; height: 170px; margin: 0 auto; flex: none; }
  .ground { position: absolute; left: 0; right: 0; bottom: -6px; width: 100%; height: 60px; overflow: visible; }
  .pool { fill: rgb(242 179 61 / 0.18); }
  .bench { position: absolute; right: 18px; bottom: 6px; width: 120px; height: 60px; fill: #2a1f19; }
  .bench .edge { fill: rgb(255 236 190 / 0.35); }
  .big { position: absolute; left: 14px; bottom: 2px; transform-origin: 50% 96%; animation: fold 520ms var(--ease-in) both; }
  /* The ember starts where the big flame stood (centre 70 px) and lands in front of the bench (centre 222 px). */
  .mover { position: absolute; left: 43px; bottom: 0; width: 54px; height: 54px; animation: across 640ms var(--ease-in-out) 460ms both; }
  .hop { position: absolute; inset: 0; animation: hop 640ms linear 460ms both; }
  .ember, .small { position: absolute; left: 0; bottom: 0; }
  .ember { animation: appear 200ms var(--ease-out) 360ms both; }
  .ember :global(svg) { filter: drop-shadow(0 0 10px rgb(242 179 61 / 0.6)); }
  .small { left: -2px; bottom: 4px; opacity: 0; animation: catch 420ms var(--ease-out) 1100ms both; }
  @keyframes fold { 0% { transform: none; opacity: 1; } 70% { transform: scale(0.6, 0.3); opacity: 1; } 100% { transform: scale(0.45, 0.2); opacity: 0; } }
  @keyframes appear { from { opacity: 0; transform: scale(1.5, 0.5); } to { opacity: 1; transform: none; } }
  @keyframes across { from { transform: translateX(0); } to { transform: translateX(152px); } }
  @keyframes hop { 0% { transform: translateY(0); } 45% { transform: translateY(-46px); } 80% { transform: translateY(0) scale(1.08, 0.9); } 100% { transform: translateY(0); } }
  @keyframes catch { from { opacity: 0; transform: scale(0.6); } 60% { opacity: 1; transform: scale(1.15); } to { opacity: 1; transform: none; } }
  .lit .ember { animation: appear 200ms var(--ease-out) 360ms both, out 200ms linear 1150ms forwards; }
  @keyframes out { to { opacity: 0; } }
  .flash { position: absolute; left: 222px; bottom: 26px; width: 160vmax; height: 160vmax; margin: 0 0 -80vmax -80vmax; border-radius: 50%; pointer-events: none;
    background: radial-gradient(closest-side, rgb(255 236 190 / 0.9), rgb(242 179 61 / 0.45) 20%, rgb(226 98 42 / 0.12) 45%, transparent 70%);
    opacity: 0; animation: flash 700ms var(--ease-out) 1100ms both; }
  @keyframes flash { 0% { opacity: 0; transform: scale(0.08); } 25% { opacity: 1; } 100% { opacity: 0; transform: scale(1); } }
  .trail { fill: none; stroke: #f7e3b0; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 1; animation: draw 700ms var(--ease-in-out) 1300ms both; }
  .trail.glow { stroke: var(--c-gold-400); stroke-width: 10; opacity: 0.35; }
  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  /* Once lit, the scene brightens and the buttons settle in after the path. */
  :global(.screen:has(.shrink.lit) > .backdrop) { animation: brighten 900ms var(--ease-out) 1150ms both; }
  @keyframes brighten { from { filter: none; } to { filter: brightness(1.16) saturate(1.12); } }
  :global(.screen:has(.shrink.lit) .actions) { animation: settle-in 2.1s var(--ease-out) both; }
  @keyframes settle-in { 0%, 85% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: none; } }

  @media (prefers-reduced-motion: reduce) {
    .big, .flash { display: none; }
    .mover, .hop, .ember, .small, .trail { animation: none; }
    .mover { transform: translateX(152px); }
    .trail { stroke-dashoffset: 0; }
    .lit .ember { display: none; }
    .small { opacity: 1; }
    :global(.screen:has(.shrink.lit) > .backdrop) { animation: none; filter: brightness(1.16) saturate(1.12); }
    :global(.screen:has(.shrink.lit) .actions) { animation: none; }
  }
  :global([data-reduce-motion]) .big, :global([data-reduce-motion]) .flash { display: none; }
  :global([data-reduce-motion]) .mover, :global([data-reduce-motion]) .hop, :global([data-reduce-motion]) .ember,
  :global([data-reduce-motion]) .small, :global([data-reduce-motion]) .trail { animation: none; }
  :global([data-reduce-motion]) .mover { transform: translateX(152px); }
  :global([data-reduce-motion]) .lit .ember { display: none; }
  :global([data-reduce-motion]) .small { opacity: 1; }
  :global([data-reduce-motion] .screen:has(.shrink.lit) > .backdrop) { animation: none; filter: brightness(1.16) saturate(1.12); }
  :global([data-reduce-motion] .screen:has(.shrink.lit) .actions) { animation: none; }
</style>
