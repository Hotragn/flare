<!-- I6 Lit (sun mode): the celebration, then where to go. Saved for no signal (SRS-OFF-1). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "lit", theme = "sun", wire = false, onfind, onhere }: { view?: string; theme?: Theme; wire?: boolean; onfind?: () => void; onhere?: () => void } = $props();
</script>

<Screen {theme} {wire} title="Fuego's Flare" offline={view === "offline" ? "Offline. Saved at 2:14 PM." : ""}>
  <div class="center">
    <Hearth state="lit" size={190} celebrate={view === "lit"} />
    {#if view === "smaller"}
      <h1 class="t-display">Smaller plan.</h1>
      <p class="t-sun">15 min at {flare.emberBench}.</p>
    {:else}
      <h1 class="t-display">It's lit.</h1>
      <p class="t-sun">{flare.hostLine}</p>
    {/if}
    <p class="t-muted">{flare.walk} · {flare.sunset}</p>
  </div>
  <InfoLines nature="" />
  {#snippet actions()}
    <Button icon="compass" onclick={onfind}>Find them</Button>
    <div class="row">
      <Button variant="secondary" icon="here" onclick={onhere}>I'm here</Button>
      <Button variant="text">Can't make it</Button>
    </div>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; }
</style>
