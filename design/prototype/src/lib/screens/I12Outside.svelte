<!--
  I12 Go outside: the end of every flow points outside, not to more app.
  view "end" follows Done ("Thanks for coming.", PRD 8); view "go" follows I8.
-->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Scenery from "../components/Scenery.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "end", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} close={false} grain={false}>
  <div class="scene wire-hide"><Scenery /></div>
  <div class="msg">
    <h1 class="t-display">{view === "go" ? t("outside.go", { spot: flare.spotShort }) : t("outside.thanks")}</h1>
    <p class="t-muted">{t("outside.quiet", { sunset: flare.sunset })}</p>
  </div>
  {#snippet actions()}
    <Button variant="secondary">{t("gone.close")}</Button>
  {/snippet}
</Screen>

<style>
  .scene { margin: 0 calc(var(--l-gutter) * -1); height: 360px; border-radius: 0 0 var(--r-xl) var(--r-xl); overflow: hidden; }
  .msg { display: flex; flex-direction: column; gap: 8px; }
  .msg h1, .msg p { margin: 0; }
</style>
