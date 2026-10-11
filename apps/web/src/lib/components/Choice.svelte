<!-- Single choice as large pills: native radio buttons (arrow keys and roving focus from the browser). Used for quorum and needs. -->
<script lang="ts">
  let { label, value = $bindable(""), options }: { label: string; value?: string; options: { value: string; label: string }[] } = $props();
  const name = `c${Math.random().toString(36).slice(2, 8)}`;
</script>

<fieldset class="choice">
  <legend class="lbl">{label}</legend>
  <div class="group">
    {#each options as o (o.value)}
      <label class="opt" class:on={value === o.value}>
        <input type="radio" {name} value={o.value} bind:group={value} />
        <span>{o.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .choice { display: flex; flex-direction: column; gap: 8px; border: 0; margin: 0; padding: 0; min-width: 0; }
  .lbl { font-weight: 700; padding: 0; margin-bottom: 8px; }
  .group { display: flex; gap: 8px; flex-wrap: wrap; }
  .opt { position: relative; min-width: 56px; min-height: 48px; padding: 0 18px; display: inline-grid; place-items: center; border-radius: var(--r-pill); border: 2px solid var(--text-muted); background: var(--surface); color: var(--text); font-weight: 700; font-size: calc(var(--t-label-size) * var(--text-scale)); transition: transform var(--dur-instant), background var(--dur-quick); cursor: pointer; }
  .opt input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .opt.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .opt:has(input:focus-visible) { outline: 3px solid var(--c-gold-400); outline-offset: 3px; }
  .opt:active { transform: scale(0.96); }
</style>
