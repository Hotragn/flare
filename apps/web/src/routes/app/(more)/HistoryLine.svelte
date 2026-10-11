<!-- Sparks history line on the invite (I1, P4; BR-K-5, SRS-SPK-2). Feed it sparkHistory() from
     ../more.ts. Renders nothing when the group hasn't met at this place. -->
<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { HistoryLine } from "./more.ts";
  let { line }: { line: HistoryLine } = $props();
</script>

{#if line}
  <p class="history t-small">
    <span>{t("invite.metHere", { n: line.times })}</span>
    {#if line.spark}<span class="spark"><Icon name="spark" size={16} />{t("invite.sparkQuote", { line: line.spark })}</span>{/if}
  </p>
{/if}

<style>
  .history { margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .spark { display: flex; gap: 6px; align-items: center; color: var(--accent-text); font-weight: 700; }
</style>
