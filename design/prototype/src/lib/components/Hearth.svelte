<!--
  Hearth: the flame in its place. A soft ground shadow, a pine horizon behind,
  and sparks that rise once when it lights (celebrate=true). Decorative parts are
  aria-hidden; the Flame carries the accessible name.
-->
<script lang="ts">
  import Flame from "./Flame.svelte";
  import type { FlameState } from "../brand";
  let { state = "lit", progress = 0, size = 220, celebrate = false, horizon = true }: { state?: FlameState; progress?: number; size?: number; celebrate?: boolean; horizon?: boolean } = $props();
  const sparks = Array.from({ length: 9 }, (_, i) => ({ x: 30 + ((i * 37) % 40), d: 0.15 * i, s: 4 + (i % 3) * 2 }));
</script>

<div class="hearth" style:--size="{size}px">
  {#if horizon}
    <svg class="hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 70 C70 40 140 72 210 54 C280 36 340 62 400 48 L400 120 L0 120 Z" fill="var(--horizon-far)" />
      <path d="M0 92 C90 74 170 100 250 86 C320 74 360 90 400 82 L400 120 L0 120 Z" fill="var(--horizon-near)" />
    </svg>
  {/if}
  <div class="ground" class:lit={state === "lit"} aria-hidden="true"></div>
  <div class="flame"><Flame {state} {progress} {size} /></div>
  {#if celebrate && state === "lit"}
    <div class="sparks" aria-hidden="true">
      {#each sparks as sp}<span style:left="{sp.x}%" style:animation-delay="{sp.d}s" style:width="{sp.s}px" style:height="{sp.s}px"></span>{/each}
    </div>
  {/if}
</div>

<style>
  .hearth {
    --horizon-far: color-mix(in srgb, var(--c-pine-500) 22%, transparent);
    --horizon-near: color-mix(in srgb, var(--c-pine-700) 28%, transparent);
    position: relative; width: 100%; height: calc(var(--size) * 1.15); display: grid; place-items: end center;
  }
  .hills { position: absolute; left: -20px; right: -20px; bottom: 0; width: calc(100% + 40px); height: 46%;
    -webkit-mask-image: radial-gradient(120% 90% at 50% 100%, #000 45%, transparent 78%); mask-image: radial-gradient(120% 90% at 50% 100%, #000 45%, transparent 78%); }
  .ground { position: absolute; bottom: 6%; width: calc(var(--size) * 0.62); height: calc(var(--size) * 0.09); border-radius: 50%; background: color-mix(in srgb, var(--c-ink-900) 18%, transparent); }
  .ground.lit { background: radial-gradient(closest-side, color-mix(in srgb, var(--c-gold-400) 55%, transparent), transparent); width: calc(var(--size) * 0.9); height: calc(var(--size) * 0.16); }
  .flame { position: relative; margin-bottom: 4%; }
  .sparks { position: absolute; inset: 0 25%; pointer-events: none; }
  .sparks span { position: absolute; bottom: 40%; border-radius: 50%; background: var(--c-gold-400); opacity: 0; animation: rise 1.6s var(--ease-out) forwards; }
  @keyframes rise { 0% { transform: translateY(0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(calc(var(--size) * -0.9)) scale(0.4); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .sparks { display: none; } }
</style>
