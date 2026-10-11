<!-- Access line (SRS-ACC-2, BR-A-4) and nature line (SRS-NAT-1). Never says "step-free". -->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Access } from "./parts";
  let { access = null, nature = "", compact = false }: { access?: Access | null; nature?: string; compact?: boolean } = $props();
  const bench = $derived(access?.benches.nearest_m ?? null);
  const restroom = $derived(access?.restrooms.nearest_m ?? null);
  const water = $derived(access?.water.nearest_m ?? null);
</script>

{#if access || nature}
  <ul class="lines" class:compact aria-label={t("access.aria")}>
    {#if access}
      {#if bench !== null}<li><Icon name="bench" size={22} /><span>{t("access.bench", { m: bench })}</span></li>
      {:else}<li><Icon name="bench" size={22} /><span>{t("access.noneNear")}</span></li>{/if}
      {#if restroom !== null}<li><Icon name="restroom" size={22} /><span>{t("access.restroom", { m: restroom })}</span></li>{/if}
      {#if water !== null}<li><Icon name="water" size={22} /><span>{t("access.water", { m: water })}</span></li>{/if}
      <li><Icon name="steps" size={22} /><span>{access.steps_mapped ? t("access.steps") : t("access.noSteps")}</span></li>
    {/if}
    {#if nature}<li class="nature"><Icon name="sunset" size={22} /><span>{nature}</span></li>{/if}
  </ul>
{/if}

<style>
  .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; }
  li { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: calc(var(--t-small-size) * var(--text-scale)); }
  .nature { color: var(--accent-text); }
  .compact li { font-weight: 500; }
</style>
