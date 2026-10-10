<!-- I8 I'm here: arrival counted; the screen tells you to look up. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import type { Theme } from "../components/parts";
  let { view = "success", theme = "sun", wire = false, ondone }: { view?: string; theme?: Theme; wire?: boolean; ondone?: () => void } = $props();
</script>

<Screen {theme} {wire} close={false}>
  <div class="center">
    <Hearth state="lit" size={180} />
    <h1 class="t-display">You made it.</h1>
    <p class="t-sun">3 of you are here. Look up.</p>
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>Pocket it</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; }
</style>
