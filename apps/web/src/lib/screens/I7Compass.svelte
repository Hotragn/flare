<!-- I7 Find them (sun mode). Speaks; works with the screen down and no signal. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Compass from "../components/Compass.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "pointing", theme = "sun", wire = false, onhere }: { view?: string; theme?: Theme; wire?: boolean; onhere?: () => void } = $props();
  const status = $derived((view === "offline" ? "pointing" : view) as "pointing" | "facing" | "no-orientation" | "no-gps");
  const meters = $derived(view === "facing" ? 60 : 400);
  const bearing = $derived(view === "facing" ? 4 : -35);
</script>

<Screen {theme} {wire} sound heading={t("compass.heading")} title={t("compass.heading")} offline={view === "offline" ? t("app.offline", { time: flare.savedAt }) : ""}>
  <div class="center">
    <Compass {status} {meters} {bearing} />
  </div>
  <p class="note t-small t-muted">{t("compass.disclaimer")}</p>
  {#snippet actions()}
    <Button icon="here" onclick={onhere}>{t("lit.here")}</Button>
    <Button variant="text">{t("compass.stop")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: grid; place-items: center; }
  .note { text-align: center; margin: 0; }
</style>
