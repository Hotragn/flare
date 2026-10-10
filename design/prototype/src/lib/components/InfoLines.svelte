<!-- Access line (SRS-ACC-2) and nature line (SRS-NAT-1). Never says "step-free". -->
<script lang="ts">
  import Icon from "./Icon.svelte";
  let {
    bench = 40,
    restroom = 180,
    water = null,
    steps = false,
    nature = "Sunset 6:57 PM",
    compact = false,
  }: { bench?: number | null; restroom?: number | null; water?: number | null; steps?: boolean; nature?: string; compact?: boolean } = $props();
</script>

<ul class="lines" class:compact aria-label="Near the spot">
  {#if bench !== null}<li><Icon name="bench" size={22} /><span>Bench {bench} m</span></li>{/if}
  {#if restroom !== null}<li><Icon name="restroom" size={22} /><span>Restroom {restroom} m</span></li>{/if}
  {#if water !== null}<li><Icon name="water" size={22} /><span>Water {water} m</span></li>{/if}
  <li><Icon name="steps" size={22} /><span>{steps ? "Steps mapped" : "No steps mapped"}</span></li>
  {#if nature}<li class="nature"><Icon name="sunset" size={22} /><span>{nature}</span></li>{/if}
</ul>

<style>
  .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; }
  li { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: calc(var(--t-small-size) * var(--text-scale)); }
  .nature { color: var(--accent-text); }
  .compact li { font-weight: 500; }
</style>
