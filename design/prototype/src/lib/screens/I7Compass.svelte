<!-- I7 Find them (sun mode). Speaks; works with the screen down and no signal. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Compass from "../components/Compass.svelte";
  import type { Theme } from "../components/parts";
  let { view = "pointing", theme = "sun", wire = false, onhere }: { view?: string; theme?: Theme; wire?: boolean; onhere?: () => void } = $props();
  const status = $derived((view === "offline" ? "pointing" : view) as "pointing" | "facing" | "no-orientation" | "no-gps");
  const meters = $derived(view === "facing" ? 60 : 400);
  const bearing = $derived(view === "facing" ? 4 : -35);
</script>

<Screen {theme} {wire} heading="Find them" title="Find them" offline={view === "offline" ? "Offline. Pointing to the spot saved at 2:14 PM." : ""}>
  <div class="center">
    <Compass {status} {meters} {bearing} />
  </div>
  <p class="note t-small t-muted">Finds your friend. Not for navigation or emergencies.</p>
  {#snippet actions()}
    <Button icon="here" onclick={onhere}>I'm here</Button>
    <Button variant="text">Stop talking</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: grid; place-items: center; }
  .note { text-align: center; margin: 0; }
</style>
