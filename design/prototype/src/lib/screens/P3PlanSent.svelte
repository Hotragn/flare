<!-- P3 Plan sent. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "success", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} close={false}>
  <div class="center">
    <Hearth state="kindling" progress={0.1} size={170} />
    <h1 class="t-display">Plan sent.</h1>
    <p class="t-sun">Answers by {plan.deadline}. We'll tell you which size it is.</p>
  </div>
  {#snippet actions()}
    <Button>Pocket it</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
</style>
