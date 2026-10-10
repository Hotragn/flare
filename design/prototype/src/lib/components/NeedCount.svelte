<!-- "Need N more". Dots show how many are in (count only, never who). -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  let { have = 1, quorum = 2, lit = false }: { have?: number; quorum?: number; lit?: boolean } = $props();
  const need = $derived(Math.max(0, quorum - have));
  const text = $derived(lit ? t("need.lit") : need === 0 ? t("need.enough") : t("need.more", { n: need }));
  // Count tick (docs/design/motion.md, count ticking): same as FlameMeter. The count
  // rises in on the spring after each change; reduced motion fades instead.
  let ticked = $state(false);
  let lastHave: number | undefined;
  $effect(() => { if (lastHave !== undefined && have !== lastHave) ticked = true; lastHave = have; });
</script>

<div class="need" role="status" aria-live="polite">
  <span class="dots" aria-hidden="true">
    {#each Array(Math.max(quorum, have)) as _, i}
      <span class="dot" class:in={i < have}></span>
    {/each}
  </span>
  {#key text}<span class="t-sun" class:tick={ticked}>{text}</span>{/key}
</div>

<style>
  .need { display: flex; align-items: center; gap: 12px; }
  .dots { display: inline-flex; gap: 6px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid var(--text); transition: background var(--dur-base) var(--ease-spring), transform var(--dur-base) var(--ease-spring); }
  .dot.in { background: var(--lit); border-color: var(--lit); transform: scale(1.12); }
  .tick { display: inline-block; animation: tick var(--dur-base) var(--ease-spring) both; }
  @keyframes tick { from { transform: translateY(0.45em); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .tick { animation: fade var(--dur-fade) linear both; } }
  :global([data-reduce-motion]) .tick { animation: fade var(--dur-fade) linear both; }
</style>
