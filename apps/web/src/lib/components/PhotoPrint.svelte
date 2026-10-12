<!--
  The photo moment. The picture develops like an instant print: it starts as warm
  blank paper, then the image rises from pale sepia to full color over
  --dur-develop (2.4 s), matching the ~3 s the hub takes to draft the six words.
  state: blank | developing | developed. Reduced motion shows the final print at once.
  `scene` is a short description used as the image's accessible name (SRS-ACC-5).
  Photo-fit: a real photo keeps its own shape (height is then the most it may take, never a
  crop), a dark one is brightened for display only, and a tap opens it full screen.
  Motion (docs/design/motion.md 3.4): only opacity animates (animated blur is a known
  slow path in iOS Safari). A white haze lifts first, the sepia veil clears from the
  middle, and the edges clear last, like a chemical print. No flash.
-->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import SampleScene from "./SampleScene.svelte";
  import { lit, zoom } from "#lib/photo-fit.ts";
  let {
    state = "developed",
    scene = "",
    src = "",
    height = 420,
    tilt = -1.2,
    sample = false,
  }: {
    state?: "blank" | "developing" | "developed";
    scene?: string;
    src?: string;
    height?: number;
    tilt?: number;
    /** Catalog only: the illustrated stand-in photo. The app always passes a real photo. */
    sample?: boolean;
  } = $props();
</script>

{#snippet layers()}
  {#if state === "developing"}
    <span class="veil" aria-hidden="true"></span>
    <span class="edge" aria-hidden="true"></span>
    <span class="haze" aria-hidden="true"></span>
  {/if}
{/snippet}

<figure class="print {state}" class:natural={!!src} style:--tilt="{tilt}deg" style:--max="{height}px" style:height={src ? undefined : `${height}px`}>
  <div class="paper grain">
    {#if src}
      <button type="button" class="image photo-art" aria-label={scene || t("invite.photoFallback")} onclick={zoom}>
        <img {src} alt="" onload={lit} />
        {@render layers()}
      </button>
    {:else}
    <div class="image photo-art" role="img" aria-label={scene || t("invite.photoFallback")}>
      {#if sample}
        <SampleScene />
      {/if}
{@render layers()}
    </div>
    {/if}
  </div>
</figure>

<style>
  .print { margin: 0; transform: rotate(var(--tilt)); transition: transform var(--dur-slow) var(--ease-spring); }
  .paper { height: 100%; padding: 12px 12px 44px; background: var(--c-birch-50); border-radius: 6px; box-shadow: var(--e-3); }
  .image { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 3px; background: #efe6d4; }
  .image :global(img), .image :global(svg) { width: 100%; height: 100%; object-fit: cover; }
  /* Photo-fit: the print wraps the photo at its own shape, at most --max tall (44% of the screen
     on short phones), so the main button still fits on a 375 x 667 screen. */
  .natural { width: fit-content; max-width: 100%; margin: 0 auto; }
  .natural .paper, .natural .image { height: auto; }
  button.image { display: block; padding: 0; border: 0; cursor: zoom-in; color: inherit; }
  .natural .image :global(img) { display: block; width: auto; height: auto; max-width: 100%; max-height: calc(min(var(--max), 44dvh) - 56px); object-fit: initial; }
  .blank .image > :global(*) { opacity: 0; }
  .developed .image > :global(*) { opacity: 1; }
  .haze, .veil, .edge { position: absolute; inset: 0; pointer-events: none; }
  .haze { background: #fbf8f2; }
  .veil { background: #c9a36a; mix-blend-mode: multiply; }
  .edge { background: radial-gradient(120% 95% at 50% 50%, transparent 52%, #8a6a3e 100%); mix-blend-mode: multiply; }
  /* 2.4 s total: image 0 to 70%; haze lifts 0 to 60%; veil clears 20 to 85%; edges clear 45 to 100%. */
  .developing .image > :global(:not(span)) { animation: develop-img var(--dur-develop) var(--ease-in-out) both; }
  .developing .haze { animation: haze var(--dur-develop) var(--ease-out) both; }
  .developing .veil { animation: veil var(--dur-develop) var(--ease-in-out) both; }
  .developing .edge { animation: edge var(--dur-develop) var(--ease-in-out) both; }
  @keyframes develop-img { 0% { opacity: 0; } 70%, 100% { opacity: 1; } }
  @keyframes haze { 0% { opacity: 0.85; } 60%, 100% { opacity: 0; } }
  @keyframes veil { 0%, 20% { opacity: 0.9; } 85%, 100% { opacity: 0; } }
  @keyframes edge { 0%, 45% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  /* Reduced motion: the finished print fades in over 160 ms; no layers. */
  @media (prefers-reduced-motion: reduce) {
    .developing .image > :global(:not(span)) { animation: fade var(--dur-fade) linear both; }
    .haze, .veil, .edge { display: none; }
  }
  :global([data-reduce-motion]) .developing .image > :global(:not(span)) { animation: fade var(--dur-fade) linear both; }
  :global([data-reduce-motion]) .haze, :global([data-reduce-motion]) .veil, :global([data-reduce-motion]) .edge { display: none; }
</style>
