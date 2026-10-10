<!-- "Need N more". Dots show how many are in (count only, never who). -->
<script lang="ts">
  let { have = 1, quorum = 2, lit = false }: { have?: number; quorum?: number; lit?: boolean } = $props();
  const need = $derived(Math.max(0, quorum - have));
  const text = $derived(lit ? "It's lit." : need === 0 ? "Enough. Lighting now." : `Need ${need} more.`);
</script>

<div class="need" role="status" aria-live="polite">
  <span class="dots" aria-hidden="true">
    {#each Array(Math.max(quorum, have)) as _, i}
      <span class="dot" class:in={i < have}></span>
    {/each}
  </span>
  <span class="t-sun">{text}</span>
</div>

<style>
  .need { display: flex; align-items: center; gap: 12px; }
  .dots { display: inline-flex; gap: 6px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid var(--text); transition: background var(--dur-base) var(--ease-spring), transform var(--dur-base) var(--ease-spring); }
  .dot.in { background: var(--lit); border-color: var(--lit); transform: scale(1.12); }
</style>
