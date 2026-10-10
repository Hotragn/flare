<!-- I4 You're in. The flame grows one notch for you; then the phone goes away. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import NeedCount from "../components/NeedCount.svelte";
  import type { Theme } from "../components/parts";
  let { view = "success", theme = "light", wire = false, ondone }: { view?: string; theme?: Theme; wire?: boolean; ondone?: () => void } = $props();
</script>

<Screen {theme} {wire} close={false} offline={view === "queued" ? "Saved. It sends when you're back online." : ""}>
  <div class="center">
    <Hearth state="kindling" progress={0.6} size={200} intro />
    <h1 class="t-display">You're in.</h1>
    <p class="t-sun">We'll buzz you when it's lit.</p>
    <NeedCount have={2} quorum={3} />
    <p class="t-muted t-small">Nobody sees who said yes. Only the count.</p>
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>Pocket it</Button>
    <Button variant="text">Take it back</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; }
  .center h1, .center p { margin: 0; }
</style>
