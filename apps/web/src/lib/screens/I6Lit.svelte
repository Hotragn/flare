<!-- I6 Lit (sun mode): the celebration, then where to go. Saved for no signal (SRS-OFF-1). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import { t, dot } from "#lib/copy/index.ts";
  import { flare, people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "lit", theme = "sun", wire = false, onfind, onhere }: { view?: string; theme?: Theme; wire?: boolean; onfind?: () => void; onhere?: () => void } = $props();
</script>

<Screen {theme} {wire} sound title={t("lit.title", { host: people.host })} offline={view === "offline" ? t("app.offline", { time: flare.savedAt }) : ""}>
  <div class="center">
    <Hearth state="lit" size={190} celebrate={view === "lit"} />
    {#if view === "smaller"}
      <h1 class="t-title">{t("ember.headline", { bench: flare.emberBench })}</h1>
    {:else}
      <h1 class="t-display">{t("lit.headline")}</h1>
      <p class="t-sun">{flare.hostLine}</p>
    {/if}
    <p class="t-muted">{dot(flare.walk, flare.sunset)}</p>
  </div>
  <InfoLines nature="" />
  {#snippet actions()}
    <Button icon="compass" onclick={onfind}>{t("lit.find")}</Button>
    <div class="row">
      <Button variant="secondary" icon="here" onclick={onhere}>{t("lit.here")}</Button>
      <Button variant="text">{t("lit.cant")}</Button>
    </div>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; }
</style>
