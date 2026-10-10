<!-- H5 Host, Kindling (sun mode). The flame grows with each yes; no names, only the count. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import NeedCount from "../components/NeedCount.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "growing", theme = "sun", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const quorum = 4;
  const have = $derived(view === "zero" ? 1 : view === "near" ? 3 : 2);
  const progress = $derived((have - 1) / (quorum - 1));
</script>

<Screen {theme} {wire} title="Your Flare" offline={view === "offline" ? "Offline. Saved at 2:14 PM." : ""}>
  <div class="center">
    <Hearth state="kindling" {progress} size={230} />
    <NeedCount {have} {quorum} />
    <p class="t-muted">{view === "zero" ? "Sent 2 min ago. Friends answer in private." : "Goes small in 18 min if it doesn't catch."}</p>
  </div>
  <p class="hostline t-small">{flare.hostLine}</p>
  {#snippet actions()}
    <Button variant="text">Cancel Flare</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
  .center p { margin: 0; max-width: 26ch; }
  .hostline { margin: 0; text-align: center; font-weight: 700; }
</style>
