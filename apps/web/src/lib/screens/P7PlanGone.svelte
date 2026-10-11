<!-- P7 Plan: not this time. Same words as a Flare. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "gone", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} close={false}>
  <div class="center">
    <Hearth state="gone" size={160} />
    <p class="t-muted">{plan.ask}</p>
    <h1 class="t-display">{t("gone.title")}</h1>
    <p>{t("gone.body")}</p>
  </div>
  {#snippet actions()}<Button variant="secondary">{t("gone.close")}</Button>{/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 24ch; }
</style>
