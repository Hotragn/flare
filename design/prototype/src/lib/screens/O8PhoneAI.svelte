<!-- O8 On-phone AI. Lab result (Oct 10): no in-browser vision model fits iPhone Safari
     (1 GiB GPU buffer cap; tabs die near 2 GB). Photo words come from the hub; this
     screen states that honestly and offers the smaller on-phone job when one passes. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import type { Theme } from "../components/parts";
  let { view = "unavailable", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} title="AI on this phone">
  <h1 class="t-title">{view === "unavailable" ? "Your words come from our laptop." : view === "ready" ? "Conditions now run on this phone." : "Run conditions on this phone?"}</h1>
  {#if view === "unavailable"}
    <p>Photo AI doesn't fit in a phone browser yet. Our laptop runs Gemma 4 and replies in about 3 seconds.</p>
    <p class="t-muted t-small">If it can't be reached, you write the six words yourself.</p>
  {:else}
    <p>A small open model reads conditions like "after 2" right here, even with no signal.</p>
    <div class="dl">
      <Icon name="info" size={20} />
      <span>{view === "downloading" ? "Downloading… 38% of 290 MB" : view === "failed" ? "Download stopped. Flare still works." : "290 MB, Wi-Fi only"}</span>
    </div>
    {#if view === "downloading"}<div class="bar" role="progressbar" aria-valuenow="38" aria-valuemin="0" aria-valuemax="100" aria-label="Download"><span style:width="38%"></span></div>{/if}
  {/if}
  {#snippet actions()}
    {#if view === "available"}<Button>Download</Button>{:else if view === "failed"}<Button>Try again</Button>{:else if view === "downloading"}<Button variant="text">Stop</Button>{:else}<Button variant="secondary">Close</Button>{/if}
  {/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
  .dl { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); font-weight: 700; }
  .bar { height: 12px; border-radius: 6px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--lit); }
</style>
