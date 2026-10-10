<!--
  The flame: Flare's main status visual.
  state: kindling | lit | ember | gone. progress (0..1) grows Kindling from 55% to 90% of full size.
  The lab recommends a WebGL shader for the live flicker in the app; this SVG/CSS
  version is the fallback and the design reference.
-->
<script lang="ts">
  import { FLAME, HOLE, DOME, ring, type FlameState } from "#lib/brand.ts";

  let {
    state = "lit",
    progress = 0,
    size = 120,
    dot = true,
    animate = true,
    label = "",
  }: { state?: FlameState; progress?: number; size?: number; dot?: boolean; animate?: boolean; label?: string } = $props();

  const scale = $derived(state === "kindling" ? 0.55 + 0.35 * Math.min(1, Math.max(0, progress)) : 1);
  const color = $derived(
    state === "kindling" ? "var(--kindling)" : state === "lit" ? "var(--lit)" : state === "ember" ? "var(--ember)" : "var(--gone)",
  );
  const flameD = `${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`;
  const emberD = `${DOME} ${ring(50, 81, 8)}`;
  const names: Record<FlameState, string> = { kindling: "Kindling", lit: "Lit", ember: "Ember", gone: "Gone" };
  const name = $derived(label || names[state]);
</script>

<svg
  class="flame {state}"
  class:animate
  width={size}
  height={size}
  viewBox="0 0 100 100"
  role="img"
  aria-label={name}
  style:--flame-color={color}
>
  {#if state === "kindling" || state === "lit"}
    <g class="grow" style:transform="translate(50px, 96px) scale({scale}) translate(-50px, -96px)">
      <g class="flicker">
        <path fill-rule="evenodd" d={flameD} fill="var(--flame-color)" />
        {#if dot && state === "lit"}
          <circle class="dot" cx={HOLE.cx} cy={HOLE.cy} r="6" fill="var(--c-gold-400)" />
        {/if}
      </g>
    </g>
  {:else if state === "ember"}
    <path class="settle" fill-rule="evenodd" d={emberD} fill="var(--flame-color)" />
  {:else}
    <g class="drift" fill="none" stroke="var(--flame-color)">
      <circle cx="50" cy="86" r="7" stroke-width="3" stroke-dasharray="3.2 3.2" opacity="0.7" />
      <path d="M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22" stroke-width="5" stroke-linecap="round" />
      <path d="M66 18 C70 13 67 8 72 3" stroke-width="4" stroke-linecap="round" opacity="0.5" />
    </g>
  {/if}
</svg>

<style>
  .flame { overflow: visible; flex: none; }
  .grow { transition: transform var(--dur-base) var(--ease-spring); transform-origin: 0 0; }
  .animate .flicker { transform-origin: 50px 96px; animation: flicker 2.6s var(--ease-in-out) infinite; }
  .animate.lit .dot { animation: glow 2.6s var(--ease-in-out) infinite; }
  .animate .settle { transform-origin: 50px 95px; animation: settle var(--dur-slow) var(--ease-out) both; }
  .animate .drift { animation: drift var(--dur-drift) var(--ease-out) both; }
  @keyframes flicker {
    0%, 100% { transform: scale(1, 1) skewX(0deg); }
    30% { transform: scale(1.015, 0.985) skewX(-1.2deg); }
    60% { transform: scale(0.99, 1.02) skewX(1deg); }
  }
  @keyframes glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.82; } }
  @keyframes settle { from { transform: scaleY(1.6); opacity: 0.6; } to { transform: scaleY(1); opacity: 1; } }
  @keyframes drift { from { transform: translate(0, 6px); opacity: 0.2; } to { transform: translate(0, 0); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .animate .flicker, .animate.lit .dot, .animate .settle, .animate .drift { animation: none; }
  }
</style>
