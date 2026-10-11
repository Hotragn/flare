<!-- I10 Not this time: the same words for everyone (SRS-ST-3). Smoke drifts away. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let { theme = "light", onclose }: { theme?: Theme; onclose?: () => void } = $props();
</script>

<Screen {theme} close={false}>
  <div class="center">
    <Hearth state="gone" size={170} />
    <h1 class="t-display">{t("gone.title")}</h1>
    <p>{t("gone.body")}</p>
  </div>
  {#snippet actions()}
    <Button variant="secondary" onclick={onclose}>{t("gone.close")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 24ch; }
</style>
