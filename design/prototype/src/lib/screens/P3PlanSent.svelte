<!-- P3 Plan sent. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "success", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} close={false}>
  <div class="center">
    <Hearth state="kindling" progress={0.1} size={170} />
    <h1 class="t-display">{t("planSent.title")}</h1>
    <p class="t-sun">{t("planSent.body", { deadline: plan.deadline })}</p>
  </div>
  {#snippet actions()}
    <Button>{t("sent.pocket")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
</style>
