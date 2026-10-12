<!-- The Hearth's one-off moments, loaded on demand (JS budget): the ignition (warm flash, rising
     sparks, the lit sound, the path to the fire drawing itself) and the cooling (ash drifting up).
     Hearth.svelte holds the still parts and the reduced-motion end states. Decorative. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { playWhenReady } from "#lib/motion/sound.ts";
  let { kind, path = true }: { kind: "ignite" | "cool"; path?: boolean } = $props();
  // Sparks start when the gold dot lights (160 ms into the catch), then one every 30 ms.
  const sparks = Array.from({ length: 9 }, (_, i) => ({ x: 30 + ((i * 37) % 40), d: 0.16 + 0.03 * i, s: 4 + (i % 3) * 2 }));
  const ash = Array.from({ length: 10 }, (_, i) => ({ x: 36 + ((i * 29) % 28), d: 0.05 * i, s: 3 + (i % 3), dx: ((i * 13) % 21) - 10 }));
  onMount(() => {
    // The flow plays the same sound when the state arrives; sound.ts drops a repeat within 120 ms.
    if (kind === "ignite") void playWhenReady("lit");
  });
</script>

{#if kind === "ignite"}
  {#if path}
    <svg class="trail-box" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
      <path class="trail glow" d="M-6 122 C60 112 96 90 150 98 S 196 114 200 113" pathLength="1" vector-effect="non-scaling-stroke" />
      <path class="trail" d="M-6 122 C60 112 96 90 150 98 S 196 114 200 113" pathLength="1" vector-effect="non-scaling-stroke" />
    </svg>
  {/if}
  <div class="flash" aria-hidden="true"></div>
  <div class="sparks" aria-hidden="true">
    {#each sparks as sp}<span style:left="{sp.x}%" style:animation-delay="{sp.d}s" style:width="{sp.s}px" style:height="{sp.s}px"></span>{/each}
  </div>
{:else}
  <div class="ash" aria-hidden="true">
    {#each ash as a}<span style:left="{a.x}%" style:animation-delay="{a.d}s" style:width="{a.s}px" style:height="{a.s}px" style:--dx="{a.dx}px"></span>{/each}
  </div>
{/if}

<style>
  .trail-box { position: absolute; left: -20px; right: -20px; bottom: 0; width: calc(100% + 40px); height: 46%; overflow: visible; pointer-events: none; }
  .trail { fill: none; stroke: #f7e3b0; stroke-width: 4px; stroke-linecap: round; stroke-dasharray: 1; animation: draw 740ms var(--ease-in-out) 360ms both; }
  .trail.glow { stroke: var(--c-gold-400); stroke-width: 12px; opacity: 0.35; }
  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  /* The flash: warm light from the fire out to the screen's edges, once. */
  .flash { position: absolute; left: 50%; bottom: 12%; width: 220vmax; height: 220vmax; margin: 0 0 -110vmax -110vmax; border-radius: 50%; pointer-events: none;
    background: radial-gradient(closest-side, rgb(255 236 190 / 0.95), rgb(242 179 61 / 0.55) 22%, rgb(226 98 42 / 0.18) 45%, transparent 70%);
    opacity: 0; animation: flash 760ms var(--ease-out) both; }
  @keyframes flash { 0% { opacity: 0; transform: scale(0.08); } 22% { opacity: 1; } 100% { opacity: 0; transform: scale(1); } }
  .sparks, .ash { position: absolute; inset: 0 25%; pointer-events: none; }
  .sparks span { position: absolute; bottom: 40%; border-radius: 50%; background: var(--c-gold-400); opacity: 0; animation: rise 0.8s var(--ease-out) forwards; }
  @keyframes rise { 0% { transform: translateY(0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(calc(var(--size) * -0.9)) scale(0.4); opacity: 0; } }
  .ash span { position: absolute; bottom: 30%; border-radius: 50%; background: #c9c3bb; opacity: 0; animation: ash 1.1s var(--ease-out) forwards; }
  @keyframes ash { 0% { transform: none; opacity: 0; } 20% { opacity: 0.9; } 100% { transform: translate(var(--dx), calc(var(--size) * -0.75)); opacity: 0; } }
  /* Reduced motion: the path is drawn, nothing moves. */
  @media (prefers-reduced-motion: reduce) { .sparks, .flash, .ash { display: none; } .trail { animation: none; } }
  :global([data-reduce-motion]) .sparks, :global([data-reduce-motion]) .flash, :global([data-reduce-motion]) .ash { display: none; }
  :global([data-reduce-motion]) .trail { animation: none; }
</style>
