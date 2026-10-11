<!-- I9 Ember (sun mode): it didn't catch, so it shrinks. One friend is enough. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare, people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "waiting", theme = "sun", wire = false, onyes }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void } = $props();
</script>

<Screen {theme} {wire} sound title={t("lit.title", { host: people.host })}>
  <div class="center">
    <Hearth state={view === "lit" ? "lit" : "ember"} size={150} celebrate={view === "lit"} />
    <h1 class="t-title">{view === "lit" ? t("lit.notice", { host: people.host, spot: flare.emberBench }) : t("ember.headline", { bench: flare.emberBench })}</h1>
    <p class="t-muted">{t("ember.where", { Bench: flare.emberBenchCap, m: flare.emberMeters, spot: flare.emberFrom })}</p>
  </div>
  {#if view !== "lit"}<FlameMeter state="ember" have={1} quorum={2} note={t("ember.meterNote")} />{/if}
  <InfoLines bench={null} restroom={140} nature={flare.sunset} />
  {#snippet actions()}
    {#if view === "lit"}
      <Button icon="compass">{t("lit.find")}</Button>
    {:else}
      <Button icon="here" onclick={onyes}>{t("invite.yes")}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
</style>
