<!-- O4 Phone check (/check, SRS-CAP-1). Sample values; the real page reads them live. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import type { Theme } from "../components/parts";
  let { view = "report", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const rows: [string, string, boolean | null][] = [
    ["iOS and Safari", "iOS 26.0 · Safari 26", true],
    ["WebGPU", "Yes · 1 GiB max buffer", true],
    ["Storage", "11.2 GB free", true],
    ["Location", "Allowed", true],
    ["Compass", "Needs a tap to allow", null],
    ["Speech", "Yes · 4 English voices", true],
    ["Web push", "Add to Home Screen first", false],
  ];
</script>

<Screen {theme} {wire} title="Phone check">
  <h1 class="t-title">{view === "running" ? "Checking this phone…" : "This phone is ready."}</h1>
  <ul class="checks" aria-busy={view === "running"}>
    {#each rows as [label, value, ok], i}
      <li>
        <span class="mark" class:ok={ok === true} class:warn={ok === null} class:no={ok === false} aria-hidden="true">{view === "running" && i > 2 ? "…" : ok === true ? "✓" : ok === null ? "!" : "×"}</span>
        <span class="lbl">{label}</span>
        <span class="val t-small">{view === "running" && i > 2 ? "Checking" : value}</span>
      </li>
    {/each}
  </ul>
  {#if view !== "running"}
    <p class="tier"><Icon name="info" size={20} /><span>Six words come from our laptop. Photo AI doesn't fit in a phone browser yet.</span></p>
  {/if}
  {#snippet actions()}<Button disabled={view === "running"}>Copy report</Button>{/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
  .checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  li { display: grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items: center; min-height: 52px; border-bottom: 1px solid var(--line); }
  .mark { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; background: var(--line); }
  .ok { background: var(--positive); color: var(--bg); }
  .warn { background: var(--c-gold-400); color: var(--c-ink-900); }
  .no { background: var(--c-ember-700); color: var(--c-birch-50); }
  .lbl { font-weight: 700; }
  .val { text-align: right; }
  .tier { display: flex; gap: 8px; align-items: flex-start; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); }
</style>
