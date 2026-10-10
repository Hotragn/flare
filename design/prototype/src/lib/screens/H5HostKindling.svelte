<!-- H5 Host, Kindling (sun mode). The flame grows with each yes; no names, only the count. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import NeedCount from "../components/NeedCount.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "growing", theme = "sun", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const quorum = 4;
  const have = $derived(view === "zero" ? 1 : view === "near" ? 3 : 2);
  const progress = $derived((have - 1) / (quorum - 1));
</script>

<Screen {theme} {wire} heading={t("host.kindling.heading")} title={t("host.kindling.title")} offline={view === "offline" ? t("app.offline", { time: flare.savedAt }) : ""}>
  <div class="center">
    <Hearth state="kindling" {progress} size={230} />
    <NeedCount {have} {quorum} />
    <p class="t-muted">{view === "zero" ? t("host.kindling.sentAgo", { min: flare.sentMin }) : t("host.kindling.shrinkIn", { min: flare.shrinkMin })}</p>
  </div>
  <p class="hostline t-small">{flare.hostLine}</p>
  {#snippet actions()}
    <Button variant="text">{t("host.kindling.cancel")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
  .center p { margin: 0; max-width: 26ch; }
  .hostline { margin: 0; text-align: center; font-weight: 700; }
</style>
