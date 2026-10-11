<!-- I8 I'm here: arrival counted (BR-H-2); the screen points you back to the people. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let { theme = "sun", here = 1, doneLabel = "", ondone }: { theme?: Theme; here?: number; doneLabel?: string; ondone?: () => void } = $props();
</script>

<Screen {theme} close={false}>
  <div class="center">
    <Hearth state="lit" size={180} />
    <h1 class="t-display">{t("here.title")}</h1>
    {#if here > 1}<p class="t-sun">{t("here.count", { n: here })}</p>{/if}
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>{doneLabel || t("sent.pocket")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; }
</style>
