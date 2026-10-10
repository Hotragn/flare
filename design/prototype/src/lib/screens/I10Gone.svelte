<!-- I10 Not this time: the same words for everyone (SRS-ST-3). Smoke drifts away. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import type { Theme } from "../components/parts";
  let { view = "gone", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} close={false}>
  <div class="center">
    <Hearth state="gone" size={170} />
    <h1 class="t-display">Not this time.</h1>
    <p>Nothing about it was kept. Try again another day.</p>
  </div>
  {#snippet actions()}
    <Button variant="secondary">Close</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 24ch; }
</style>
