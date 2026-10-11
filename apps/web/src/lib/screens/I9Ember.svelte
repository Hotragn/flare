<!-- I9 Ember (sun mode): it didn't catch, so it shrinks to a bench close by. One friend is enough (BR-E-1 to -5). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { InviteInfo, Theme } from "../components/parts";
  let {
    view = "waiting",
    theme = "sun",
    info,
    bench,
    meters = null,
    have = 1,
    answered = false,
    error = "",
    busy = false,
    onyes,
    onfind,
    onclose,
  }: {
    view?: "waiting" | "lit";
    theme?: Theme;
    info: InviteInfo;
    bench: string; // Ember place name ("the bench by the lot"); the spot itself when none qualified
    meters?: number | null; // from the spot
    have?: number;
    answered?: boolean;
    error?: string;
    busy?: boolean;
    onyes?: () => void;
    onfind?: () => void;
    onclose?: () => void;
  } = $props();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<Screen {theme} sound {onclose} title={t("lit.title", { host: info.host })} stage backdrop={info.photo} backdropAlt={info.scene}>
  {#snippet hero()}
  <div class="center">
    <Hearth state={view === "lit" ? "lit" : "ember"} size={150} celebrate={view === "lit"} />
    <h1 class="t-title">{view === "lit" ? t("lit.notice", { host: info.host, spot: bench }) : t("ember.headline", { bench })}</h1>
    {#if meters !== null}<p class="t-muted">{t("ember.where", { Bench: cap(bench), m: meters, spot: info.spot })}</p>{/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>
  {/snippet}
  {#if view !== "lit"}<FlameMeter state="ember" {have} quorum={2} note={t("ember.meterNote")} />{/if}
  <InfoLines access={info.access} nature={info.nature} />
  {#snippet actions()}
    {#if view === "lit"}
      <Button icon="compass" onclick={onfind}>{t("lit.find")}</Button>
    {:else if !answered}
      <Button icon="here" haptic="tap" loading={busy} onclick={onyes}>{t("invite.yes")}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .center { text-align: left; align-items: flex-start; }
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .err { font-weight: 700; }
</style>
