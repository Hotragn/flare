<!-- P2 Ladder: four sizes of the plan, biggest first (BR-P-4). Drafted on the hub (~3 s) or from a template. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Ladder from "../components/Ladder.svelte";
  import Sheet from "../components/Sheet.svelte";
  import TextField from "../components/TextField.svelte";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "drafted", theme = "light", wire = false, onsend }: { view?: string; theme?: Theme; wire?: boolean; onsend?: () => void } = $props();
  const steps = $derived(view === "after-sunset" ? plan.steps.map((s, i) => (i === 0 ? { ...s, minutes: 120, afterSunset: true } : s)) : plan.steps);
  let stepName = $state(plan.steps[1].name);
</script>

<Screen {theme} {wire} title={plan.ask}>
  <div class="intro">
    <h1 class="t-title">If people are tired, it gets smaller.</h1>
    <p class="t-muted">Anyone can quietly make it one step smaller. Nobody sees who.</p>
  </div>
  {#if view === "drafting"}
    <ol class="sk" aria-hidden="true">{#each [0, 1, 2, 3] as _}<li></li>{/each}</ol>
    <p class="t-muted" role="status">Drafting 4 steps from the map and the weather…</p>
  {:else}
    <Ladder {steps} editable editing={view === "editing" ? 1 : -1} />
    <p class="t-small t-muted">Made on our laptop from OpenStreetMap and today's sunset.</p>
  {/if}
  {#snippet actions()}
    <Button icon="share" onclick={onsend} disabled={view === "drafting"}>Send it</Button>
  {/snippet}
  {#snippet overlay()}
    {#if view === "editing"}
      <Sheet inline title="Step 2">
        <TextField label="Name" bind:value={stepName} max={40} />
        <div class="mins"><span class="lbl">Minutes</span><span class="t-heading">30</span></div>
        <Button>Save step</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .intro { display: flex; flex-direction: column; gap: 6px; }
  .intro h1, .intro p, p { margin: 0; }
  .sk { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .sk li { height: 72px; border-radius: var(--r-md); background: color-mix(in srgb, var(--text) 8%, transparent); animation: pulse 1.4s infinite; }
  .mins { display: flex; justify-content: space-between; align-items: center; }
  .lbl { font-weight: 700; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .sk li { animation: none; } }
</style>
