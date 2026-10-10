<!-- I12 Go outside: the end of every flow points outside, not to more app. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Scenery from "../components/Scenery.svelte";
  import type { Theme } from "../components/parts";
  let { view = "end", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} close={false} grain={false}>
  <div class="scene wire-hide"><Scenery /></div>
  <div class="msg">
    <h1 class="t-display">Go. They're by the pond.</h1>
    <p class="t-muted">Flare goes quiet now. Sunset is 6:57 PM.</p>
  </div>
  {#snippet actions()}
    <Button variant="secondary">Close</Button>
  {/snippet}
</Screen>

<style>
  .scene { margin: 0 calc(var(--l-gutter) * -1); height: 360px; border-radius: 0 0 var(--r-xl) var(--r-xl); overflow: hidden; }
  .msg { display: flex; flex-direction: column; gap: 8px; }
  .msg h1, .msg p { margin: 0; }
</style>
