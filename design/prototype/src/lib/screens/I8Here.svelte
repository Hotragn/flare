<!-- I8 I'm here: arrival counted; the screen points you back to the people. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "success", theme = "sun", wire = false, ondone }: { view?: string; theme?: Theme; wire?: boolean; ondone?: () => void } = $props();
</script>

<Screen {theme} {wire} close={false}>
  <div class="center">
    <Hearth state="lit" size={180} />
    <h1 class="t-display">{t("here.title")}</h1>
    <p class="t-sun">{t("here.count", { n: flare.here })}</p>
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>{t("sent.pocket")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; }
</style>
