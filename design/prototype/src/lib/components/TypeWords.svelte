<!-- The six words arrive one by one while the print develops. Screen readers hear
     the whole line once, when it is complete (aria-live polite).
     Motion (docs/design/motion.md 3.4): one word every 220 ms (--dur-word), each rises 8 px
     on the spring over 260 ms. `delay` holds the first word so the photo leads (use 1440 ms,
     60% of the develop, when the draft comes back early). Reduced motion: all words at once. -->
<script lang="ts">
  import { reducedMotion } from "#lib/motion/core.ts";
  let { text = "", play = true, step = 220, delay = 0, onDone }: { text?: string; play?: boolean; step?: number; delay?: number; onDone?: () => void } = $props();
  let el: HTMLParagraphElement | undefined = $state();
  const words = $derived(text.split(/\s+/).filter(Boolean));
  let shown = $state(0);
  $effect(() => {
    const total = words.length;
    if (!play || reducedMotion(el)) { shown = total; onDone?.(); return; }
    shown = 0;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      shown = 1;
      id = setInterval(() => { shown += 1; if (shown >= total) { clearInterval(id); onDone?.(); } }, step);
    }, delay);
    return () => { clearTimeout(start); clearInterval(id); };
  });
</script>

<p class="t-invite words" aria-live="polite" bind:this={el}>
  <span class="visually-hidden">{shown >= words.length ? text : ""}</span>
  <span aria-hidden="true">
    {#each words as w, i}
      <span class="w" class:on={i < shown}>{w}</span>{" "}
    {/each}
  </span>
</p>

<style>
  .words { margin: 0; min-height: 2.3em; }
  .w { display: inline-block; opacity: 0; transform: translateY(8px); transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-spring); }
  @media (prefers-reduced-motion: reduce) { .w { transform: none; transition: opacity var(--dur-fade) linear; } }
  :global([data-reduce-motion]) .w { transform: none; transition: opacity var(--dur-fade) linear; }
  .w.on { opacity: 1; transform: none; }
</style>
