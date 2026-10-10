<!-- H4 Sent. The share sheet opens on its own; this screen tells the host to put the phone away. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let { view = "success", theme = "light", wire = false, ondone }: { view?: string; theme?: Theme; wire?: boolean; ondone?: () => void } = $props();
</script>

<Screen {theme} {wire} close={false}>
  <div class="center">
    <Hearth state="kindling" progress={0.15} size={170} />
    <h1 class="t-display">{t("sent.title")}</h1>
    <p class="t-sun">{t("sent.body")}</p>
    <p class="t-muted">{t("sent.shrinkNote")}</p>
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>{t("sent.pocket")}</Button>
    <Button variant="text" icon="share">{t("sent.shareAgain")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; }
  .center p, .center h1 { margin: 0; max-width: 20ch; }
</style>
