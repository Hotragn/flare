<!-- O2 My needs: set once, stored only on this phone (BR-A-1). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Choice from "../components/Choice.svelte";
  import Icon from "../components/Icon.svelte";
  import type { Theme } from "../components/parts";
  let { view = "set", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  let steps = $state("yes");
  let rest = $state("200");
  let wc = $state("yes");
  $effect(() => { if (view === "empty") { steps = ""; rest = ""; wc = ""; } });
</script>

<Screen {theme} {wire} title="My needs">
  <p class="lock"><Icon name="info" size={20} /><span>Only on this phone. Friends never see these.</span></p>
  <Choice label="Avoid steps" bind:value={steps} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
  <Choice label="A seat at least every" bind:value={rest} options={[{ value: "100", label: "100 m" }, { value: "200", label: "200 m" }, { value: "400", label: "400 m" }, { value: "none", label: "No need" }]} />
  <Choice label="Restroom within 300 m" bind:value={wc} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
  <p class="t-small t-muted">If a spot doesn't fit, Flare offers you a closer one, and nobody learns why.</p>
  {#snippet actions()}<Button>Save</Button>{/snippet}
</Screen>

<style>
  .lock { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); font-weight: 700; }
  p { margin: 0; }
</style>
