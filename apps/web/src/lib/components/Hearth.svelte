<!--
  Hearth: the flame in its place. A soft ground shadow, a pine horizon behind,
  and sparks that rise once when it lights (celebrate=true). Decorative parts are
  aria-hidden; the Flame carries the accessible name.
  celebrate on a Lit flame is the ignition (about 1.2 s): a warm flash, the flame catches,
  the lit sound (muted with the app's sound toggle), the scene behind the screen brightens,
  and the path to the fire draws itself on the ground before the buttons settle in.
  cool on a Gone flame: the ember cools to grey and ash drifts up once. Not dead, done.
  Reduced motion: the end of each moment, still (path drawn, scene bright, ember grey).
-->
<script lang="ts">
  import Flame from "./Flame.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { FlameState } from "../brand";
  let {
    state = "lit",
    progress = 0,
    size = 220,
    celebrate = false,
    horizon = true,
    intro = undefined,
    path = undefined,
    cool = false,
  }: {
    state?: FlameState; progress?: number; size?: number; celebrate?: boolean; horizon?: boolean; intro?: boolean;
    /** Draw the path to the fire on the ground; on by default with the ignition. */
    path?: boolean;
    /** Gone: show the ember cooling and ash rising instead of the smoke curl. */
    cool?: boolean;
  } = $props();
  const ignite = $derived(celebrate && state === "lit");
  const cooling = $derived(cool && state === "gone");
</script>

<div class="hearth" class:ignite style:--size="{size}px">
  {#if horizon}
    <svg class="hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 70 C70 40 140 72 210 54 C280 36 340 62 400 48 L400 120 L0 120 Z" fill="var(--horizon-far)" />
      <path d="M0 92 C90 74 170 100 250 86 C320 74 360 90 400 82 L400 120 L0 120 Z" fill="var(--horizon-near)" />
    </svg>
  {/if}
  {#if ignite || cooling}
    {#await import("./HearthFx.svelte") then { default: Fx }}<Fx kind={ignite ? "ignite" : "cool"} path={path ?? true} />{/await}
  {/if}
  <div class="ground" class:lit={state === "lit"} aria-hidden="true"></div>
  <div class="flame" class:cool={cooling}>
    {#if cooling}
      <Flame state="ember" label={t("flame.gone")} {size} animate={false} mode="css" />
    {:else}
      <Flame {state} {progress} {size} intro={intro ?? (ignite ? true : undefined)} />
    {/if}
  </div>
</div>

<style>
  .hearth {
    --horizon-far: color-mix(in srgb, var(--c-pine-500) 22%, transparent);
    --horizon-near: color-mix(in srgb, var(--c-pine-700) 28%, transparent);
    position: relative; width: 100%; height: calc(var(--size) * 1.15); display: grid; place-items: end center;
  }
  .hills { position: absolute; left: -20px; right: -20px; bottom: 0; width: calc(100% + 40px); height: 46%;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 18%, #000 82%, transparent), linear-gradient(to bottom, #000 45%, transparent 96%); -webkit-mask-composite: source-in;
    mask-image: linear-gradient(to right, transparent, #000 18%, #000 82%, transparent), linear-gradient(to bottom, #000 45%, transparent 96%); mask-composite: intersect; }
  .ground { transition: width var(--dur-slow) var(--ease-spring), height var(--dur-slow) var(--ease-spring), background var(--dur-slow); position: absolute; bottom: 6%; width: calc(var(--size) * 0.62); height: calc(var(--size) * 0.09); border-radius: 50%; background: color-mix(in srgb, var(--c-ink-900) 18%, transparent); }
  .ground.lit { background: radial-gradient(closest-side, color-mix(in srgb, var(--c-gold-400) 55%, transparent), transparent); width: calc(var(--size) * 0.9); height: calc(var(--size) * 0.16); }
  .flame { position: relative; margin-bottom: 4%; }
  /* The scene behind the screen brightens and stays bright while it's Lit. */
  :global(.screen:has(.hearth.ignite) > .backdrop), :global(.screen:has(.hearth.ignite) > .lm > .backdrop) { animation: brighten 900ms var(--ease-out) 120ms both; }
  @keyframes brighten { from { filter: none; } to { filter: brightness(1.16) saturate(1.12); } }
  /* The buttons settle in once the path is drawn ("Find them" after the path). */
  :global(.screen:has(.hearth.ignite) .actions) { animation: settle-in 1.2s var(--ease-out) both; }
  @keyframes settle-in { 0%, 72% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: none; } }

  /* Gone: the ember cools, ash drifts up once. */
  .cool { animation: cool 1.1s var(--ease-in-out) both; }
  @keyframes cool { from { filter: none; } to { filter: grayscale(1) brightness(0.75); } }
  @media (prefers-reduced-motion: reduce) {
    .cool { animation: none; }
    .cool { filter: grayscale(1) brightness(0.75); }
    :global(.screen:has(.hearth.ignite) > .backdrop), :global(.screen:has(.hearth.ignite) > .lm > .backdrop) { animation: none; filter: brightness(1.16) saturate(1.12); }
    :global(.screen:has(.hearth.ignite) .actions) { animation: none; }
  }
  :global([data-reduce-motion]) .cool { animation: none; filter: grayscale(1) brightness(0.75); }
  :global([data-reduce-motion] .screen:has(.hearth.ignite) > .backdrop), :global([data-reduce-motion] .screen:has(.hearth.ignite) > .lm > .backdrop) { animation: none; filter: brightness(1.16) saturate(1.12); }
  :global([data-reduce-motion] .screen:has(.hearth.ignite) .actions) { animation: none; }
</style>
