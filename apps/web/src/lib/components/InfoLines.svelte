<!-- Access chips (SRS-ACC-2, BR-A-4) and the nature line (SRS-NAT-1). 2026 direction: chips
     only for what is mapped ("Bench 40 m", "Restroom 180 m"), one quiet "Access unknown here"
     when nothing is, never a list of absences. Never says "step-free": an unmapped step is not
     proof there are none, so steps show only when they are mapped. The generic season line
     ("Week 3 of fall") is dropped; a real notice-this line (sunset, water, a feature) stays. -->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Access } from "./parts";
  let { access = null, nature = "", compact = false }: { access?: Access | null; nature?: string; compact?: boolean } = $props();
  const bench = $derived(access?.benches.nearest_m ?? null);
  // The Ember bench is itself the nearest bench (BUG-065): say so instead of "Bench 0 m".
  const HERE_M = 10;
  const restroom = $derived(access?.restrooms.nearest_m ?? null);
  const water = $derived(access?.water.nearest_m ?? null);
  const steps = $derived(access?.steps_mapped === true);
  const known = $derived(bench !== null || restroom !== null || water !== null || steps);
  const SEASON = /^Week \d+ of \w+\.?$/;
  const notice = $derived(nature && !SEASON.test(nature.trim()) ? nature : "");
</script>

{#if access || notice}
  <ul class="chips" class:compact aria-label={t("access.aria")}>
    {#if access && known}
      {#if bench !== null}<li><Icon name="bench" size={20} /><span>{bench <= HERE_M ? t("access.benchHere") : t("access.bench", { m: bench })}</span></li>{/if}
      {#if restroom !== null}<li><Icon name="restroom" size={20} /><span>{t("access.restroom", { m: restroom })}</span></li>{/if}
      {#if water !== null}<li><Icon name="water" size={20} /><span>{t("access.water", { m: water })}</span></li>{/if}
      {#if steps}<li><Icon name="steps" size={20} /><span>{t("access.steps")}</span></li>{/if}
    {:else if access}
      <li class="quiet"><Icon name="info" size={20} /><span>{t("access.unknown")}</span></li>
    {/if}
    {#if notice}<li class="nature"><Icon name="sunset" size={20} /><span>{notice}</span></li>{/if}
  </ul>
{/if}

<style>
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  li { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-weight: 600;
    font-size: calc(var(--t-small-size) * var(--text-scale)); background: color-mix(in srgb, currentColor 12%, transparent); }
  .quiet { background: transparent; padding-left: 0; font-weight: 500; opacity: 0.9; }
  .nature { color: var(--accent-text); }
  .compact li { font-weight: 500; }
</style>
