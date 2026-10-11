<!-- Single choice as large pills (Bits UI ToggleGroup: arrow keys, roving focus). Used for quorum and needs. -->
<script lang="ts">
  import { ToggleGroup } from "bits-ui";
  let { label, value = $bindable(""), options }: { label: string; value?: string; options: { value: string; label: string }[] } = $props();
</script>

<div class="choice">
  <span class="lbl" id="lbl-{label}">{label}</span>
  <ToggleGroup.Root type="single" bind:value aria-labelledby="lbl-{label}" class="group">
    {#each options as o}
      <ToggleGroup.Item value={o.value} class="opt" aria-label={o.label}>{o.label}</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</div>

<style>
  .choice { display: flex; flex-direction: column; gap: 8px; }
  .lbl { font-weight: 700; }
  :global(.group) { display: flex; gap: 8px; flex-wrap: wrap; }
  :global(.opt) { min-width: 56px; min-height: 48px; padding: 0 18px; border-radius: var(--r-pill); border: 2px solid var(--text-muted); background: var(--surface); color: var(--text); font-weight: 700; font-size: calc(var(--t-label-size) * var(--text-scale)); transition: transform var(--dur-instant), background var(--dur-quick); }
  :global(.opt[data-state="on"]) { background: var(--text); color: var(--bg); border-color: var(--text); }
  :global(.opt:active) { transform: scale(0.96); }
</style>
