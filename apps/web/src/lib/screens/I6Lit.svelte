<!-- I6 Lit (sun mode): host line, spot, walk, access and nature lines, Find them, I'm here (SRS-LIT-2). Works offline (SRS-OFF-2). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import ShrinkLater from "../components/ShrinkLater.svelte";
  import Hearth from "../components/Hearth.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import Sheet from "../components/Sheet.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { InviteInfo, Theme } from "../components/parts";
  let {
    together = null,
    view = "lit",
    theme = "sun",
    info,
    savedAt = "",
    smallerAt = "",
    cant = false,
    error = "",
    busy = false,
    onfind,
    onhere,
    oncant,
    onclose,
    sky = undefined,
  }: {
    /** Minutes outside together once 2+ have arrived (2026 direction, B). */
    together?: number | null;
    view?: "lit" | "offline" | "smaller";
    theme?: Theme;
    info: InviteInfo;
    savedAt?: string; // "2:14 PM" when the screen is from the offline copy
    smallerAt?: string; // the Ember bench name when the Flare got smaller
    cant?: boolean; // this person said "Can't make it"
    error?: string;
    busy?: boolean;
    onfind?: () => void;
    onhere?: () => void;
    oncant?: () => void;
    onclose?: () => void;
    sky?: import("#lib/motion/sky.ts").SkyInput;
  } = $props();
  // Smaller: the shrink and the catch at the bench play in the drawn scene (Shrink), not the photo.
  const smaller = $derived(view === "smaller" && !!smallerAt);
  let asking = $state(false);
</script>

<Screen {theme} sound {onclose} title={t("lit.title", { host: info.host })} offline={savedAt ? t("app.offline", { time: savedAt }) : ""} stage backdrop={smaller ? "" : info.photo} backdropAlt={info.scene} fallbackArt {sky}>
  {#snippet hero()}
  <div class="center" class:smaller>
    {#if smaller}
      <h1 class="t-title">{t("ember.headline", { bench: smallerAt })}</h1>
    {:else}
      <Hearth state="lit" size={190} celebrate={view === "lit" && !savedAt} />
      <h1 class="t-display">{t("lit.headline")}</h1>
      <p class="t-sun">{info.hostLine}</p>
    {/if}
    {#if together !== null}<p class="together">{t("lit.together", { min: together })}</p>
    {:else if info.walkMin !== null}<p class="t-muted">{t("invite.walk", { min: info.walkMin })}</p>{/if}
    {#if cant}<p class="t-muted" role="status">{t("lit.cantDone")}</p>{/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    {#if smaller}
      <ShrinkLater lit={!savedAt} />
    {/if}
  </div>
  {/snippet}
  <InfoLines access={info.access} nature={info.nature} />
  {#snippet actions()}
    <Button icon="compass" onclick={onfind}>{t("lit.find")}</Button>
    <div class="row">
      <Button variant="secondary" icon="here" loading={busy} onclick={onhere}>{t("lit.here")}</Button>
      {#if !cant}<Button variant="text" onclick={() => (asking = true)}>{t("lit.cant")}</Button>{/if}
    </div>
  {/snippet}
  {#snippet overlay()}
    {#if asking}
      <Sheet inline title={t("lit.cantSheet.title")} description={t("lit.cantSheet.body")}>
        <Button variant="secondary" onclick={() => { asking = false; oncant?.(); }}>{t("lit.cantSheet.yes")}</Button>
        <Button variant="text" onclick={() => (asking = false)}>{t("lit.cantSheet.no")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .together { margin: 0; font-weight: 700; color: var(--c-gold-400); }
  .center { text-align: left; align-items: flex-start; }
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .center.smaller { justify-content: space-between; padding-top: 8px; }
  .center.smaller :global(.shrink) { order: 9; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; }
  .err { font-weight: 700; }
</style>
