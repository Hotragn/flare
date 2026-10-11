<!--
  I12 Go outside: the end of every flow points outside, not to more app.
  view "end" follows Done ("Thanks for coming.", PRD 8); view "go" follows I8.
-->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Scenery from "../components/Scenery.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "end",
    theme = "light",
    spot = "",
    sunset = "",
    onclose,
  }: { view?: "end" | "go"; theme?: Theme; spot?: string; sunset?: string; onclose?: () => void } = $props();
</script>

<Screen {theme} close={false} grain={false}>
  <div class="scene"><Scenery /></div>
  <div class="msg">
    <h1 class="t-display">{view === "go" && spot ? t("outside.go", { spot }) : t("outside.thanks")}</h1>
    {#if sunset}<p class="t-muted">{t("outside.quiet", { sunset })}</p>{/if}
  </div>
  {#snippet actions()}
    <Button variant="secondary" onclick={onclose}>{t("gone.close")}</Button>
  {/snippet}
</Screen>

<style>
  .scene { margin: 0 calc(var(--l-gutter) * -1); height: 360px; border-radius: 0 0 var(--r-xl) var(--r-xl); overflow: hidden; }
  .msg { display: flex; flex-direction: column; gap: 8px; }
  .msg h1, .msg p { margin: 0; }
</style>
