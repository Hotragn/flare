<!-- I9 Ember (sun mode): it didn't catch, so it shrinks. One friend is enough. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "waiting", theme = "sun", wire = false, onyes }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void } = $props();
</script>

<Screen {theme} {wire} title="Fuego's Flare">
  <div class="center">
    <Hearth state={view === "lit" ? "lit" : "ember"} size={150} celebrate={view === "lit"} />
    <h1 class="t-title">{view === "lit" ? "It's lit, smaller." : "Smaller plan: 15 min at the bench."}</h1>
    <p class="t-muted">{flare.emberBench[0].toUpperCase() + flare.emberBench.slice(1)}, {flare.emberDistance}.</p>
    
  </div>
  {#if view !== "lit"}<FlameMeter state="ember" have={1} quorum={2} note="One more friend and it's on." />{/if}
  <InfoLines bench={null} restroom={140} nature="You'll be sitting on the bench." />
  {#snippet actions()}
    {#if view === "lit"}
      <Button icon="compass">Find them</Button>
    {:else}
      <Button icon="here" onclick={onyes}>I'm in</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
</style>
