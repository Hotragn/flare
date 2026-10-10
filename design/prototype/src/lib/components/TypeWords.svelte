<!-- The six words arrive one by one while the print develops. Screen readers hear
     the whole line once, when it is complete (aria-live polite). -->
<script lang="ts">
  let { text = "", play = true, step = 220, onDone }: { text?: string; play?: boolean; step?: number; onDone?: () => void } = $props();
  const words = $derived(text.split(/\s+/).filter(Boolean));
  let shown = $state(0);
  $effect(() => {
    const total = words.length;
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!play || reduce) { shown = total; onDone?.(); return; }
    shown = 0;
    const id = setInterval(() => { shown += 1; if (shown >= total) { clearInterval(id); onDone?.(); } }, step);
    return () => clearInterval(id);
  });
</script>

<p class="t-invite words" aria-live="polite">
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
  .w.on { opacity: 1; transform: none; }
</style>
