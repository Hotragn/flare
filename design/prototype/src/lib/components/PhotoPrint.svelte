<!--
  The photo moment. The picture develops like an instant print: it starts as warm
  blank paper, then the image rises from pale sepia to full color over
  --dur-develop (2.4 s), matching the ~3 s the hub takes to draft the six words.
  state: blank | developing | developed. Reduced motion shows the final print at once.
  `scene` is a short description used as the image's accessible name (SRS-ACC-5).
-->
<script lang="ts">
  import SampleScene from "./SampleScene.svelte";
  let {
    state = "developed",
    scene = "",
    src = "",
    height = 420,
    tilt = -1.2,
  }: { state?: "blank" | "developing" | "developed"; scene?: string; src?: string; height?: number; tilt?: number } = $props();
</script>

<figure class="print {state}" style:--tilt="{tilt}deg" style:height="{height}px">
  <div class="paper grain">
    <div class="image photo-art" role="img" aria-label={scene || "Invite photo"}>
      {#if src}
        <img {src} alt="" />
      {:else}
        <SampleScene />
      {/if}
    </div>
  </div>
</figure>

<style>
  .print { margin: 0; transform: rotate(var(--tilt)); transition: transform var(--dur-slow) var(--ease-spring); }
  .paper { height: 100%; padding: 12px 12px 44px; background: var(--c-birch-50); border-radius: 6px; box-shadow: var(--e-3); }
  .image { width: 100%; height: 100%; overflow: hidden; border-radius: 3px; background: #efe6d4; }
  .image :global(img), .image :global(svg) { width: 100%; height: 100%; object-fit: cover; }
  .blank .image > :global(*) { opacity: 0; }
  .developing .image > :global(*) { animation: develop var(--dur-develop) var(--ease-in-out) both; }
  .developed .image > :global(*) { opacity: 1; filter: none; }
  @keyframes develop {
    0% { opacity: 0; filter: sepia(1) saturate(0.3) brightness(1.5) contrast(0.6) blur(2px); }
    35% { opacity: 0.55; filter: sepia(0.8) saturate(0.5) brightness(1.3) contrast(0.7) blur(1px); }
    70% { opacity: 0.9; filter: sepia(0.3) saturate(0.85) brightness(1.08) contrast(0.92); }
    100% { opacity: 1; filter: none; }
  }
  @media (prefers-reduced-motion: reduce) { .developing .image > :global(*) { animation: none; opacity: 1; } }
</style>
