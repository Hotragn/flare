<!--
  H2 Develop: the photo moment. The print develops (2.4 s) while the hub drafts
  six words (~3 s, lab report). If the hub can't be reached, the host types them.
-->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import TypeWords from "../components/TypeWords.svelte";
  import TextField from "../components/TextField.svelte";
  import Icon from "../components/Icon.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import { t, dot } from "#lib/copy/index.ts";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "drafted", theme = "light", wire = false, onuse }: { view?: string; theme?: Theme; wire?: boolean; onuse?: () => void } = $props();
  let own = $state("");
</script>

<Screen {theme} {wire} heading={t("develop.heading")} offline={view === "offline" ? t("develop.offline") : ""}>
  <PhotoPrint state={view === "developing" ? "developing" : "developed"} scene={flare.scene} height={290} />
  <p class="spot"><Icon name="hotspots" size={20} /><span>{flare.spot}</span></p>
  {#if view === "developing"}
    <p class="t-invite pending" role="status">{t("develop.writing")}</p>
  {:else if view === "drafted"}
    <TypeWords text={flare.words} />
    <p class="tier t-small t-muted">{dot(t("app.tier.hub"), t("develop.editHint"))}</p>
    <FlameMeter have={1} quorum={2} note={t("develop.flameNote")} />
  {:else}
    <p class="t-muted t-small notice"><Icon name="info" size={20} />{view === "offline" ? t("develop.noSignal") : t("develop.hubDown")}</p>
    <TextField label={t("develop.fieldLabel")} bind:value={own} placeholder={t("develop.template", { spot: flare.spotShort })} max={48} />
  {/if}
  {#snippet actions()}
    <Button disabled={view === "developing"} onclick={onuse}>{view === "drafted" ? t("develop.use") : t("develop.useMine")}</Button>
    {#if view === "drafted"}<Button variant="text" icon="edit">{t("develop.writeOwn")}</Button>{/if}
  {/snippet}
</Screen>

<style>
  .spot { display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 700; }
  .pending { color: var(--text-muted); animation: breathe 1.6s var(--ease-in-out) infinite; margin: 0; }
  .tier, .notice { margin: 0; display: flex; gap: 6px; align-items: center; }
  @keyframes breathe { 50% { opacity: 0.5; } }
  @media (prefers-reduced-motion: reduce) { .pending { animation: none; } }
</style>
