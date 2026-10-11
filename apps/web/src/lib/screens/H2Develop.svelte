<!--
  H2 Develop: the photo moment. The print develops (2.4 s) while the hub drafts six words
  (about 3 s, lab report 08). If the hub can't be reached, the host types them (BR-AI-1).
-->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import TypeWords from "../components/TypeWords.svelte";
  import TextField from "../components/TextField.svelte";
  import Icon from "../components/Icon.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import Sheet from "../components/Sheet.svelte";
  import { t, dot } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "drafted",
    theme = "light",
    photo = "",
    scene = "",
    spot = "",
    words = "",
    tier = "hub",
    cloud = false,
    onaskcloud,
    chips = [],
    own = $bindable(""),
    askLocation = false,
    typedSpot = $bindable(""),
    sample = false,
    onuse,
    onwrite,
    onallowlocation,
    onskiplocation,
  }: {
    view?: "developing" | "drafted" | "hub-unreachable" | "offline";
    theme?: Theme;
    photo?: string;
    scene?: string;
    spot?: string;
    words?: string;
    tier?: "hub" | "rules" | "cloud";
    /** ADR-0022: offer DigitalOcean for this photo (hub down, cloud tier configured). */
    cloud?: boolean;
    onaskcloud?: () => void;
    chips?: string[]; // place words for the typed fallback (ADR-0007)
    own?: string;
    askLocation?: boolean;
    typedSpot?: string;
    sample?: boolean;
    onuse?: (words: string) => void;
    onwrite?: () => void;
    onallowlocation?: () => void;
    onskiplocation?: () => void;
  } = $props();
  const wordCount = $derived(own.trim().split(/\s+/).filter(Boolean).length);
  const tooLong = $derived(wordCount > 6);
  const addChip = (w: string) => (own = own.trim() ? `${own.trim()} ${w}` : w);
</script>

<Screen {theme} heading={t("develop.heading")} offline={view === "offline" ? t("develop.offline") : ""}>
  <PhotoPrint state={view === "developing" ? "developing" : "developed"} {scene} src={photo} {sample} height={290} />
  {#if spot}<p class="spot"><Icon name="hotspots" size={20} /><span>{spot}</span></p>{/if}
  {#if view === "developing"}
    <p class="t-invite pending" role="status">{t("develop.writing")}</p>
  {:else if view === "drafted"}
    <TypeWords text={words} />
    <p class="tier t-small t-muted">{dot(t(tier === "hub" ? "app.tier.hub" : tier === "cloud" ? "app.tier.cloud" : "app.tier.rules"), t("develop.editHint"))}</p>
    <FlameMeter have={1} quorum={2} note={t("develop.flameNote")} />
  {:else}
    <p class="t-muted t-small notice"><Icon name="info" size={20} />{view === "offline" ? t("develop.noSignal") : cloud ? t("develop.hubDownCloud") : t("develop.hubDown")}</p>
    <TextField label={t("develop.fieldLabel")} bind:value={own} placeholder={t("develop.template", { spot: spot || t("perm.locationHost.placeholder") })} error={tooLong ? t("develop.tooLong") : ""} max={48} />
    {#if view === "hub-unreachable" && cloud}
      <div class="cloud">
        <Button variant="secondary" onclick={onaskcloud}>{t("develop.askCloud")}</Button>
        <p class="t-small t-muted">{t("develop.askCloudNote")}</p>
      </div>
    {/if}
    {#if chips.length}
      <ul class="chips">{#each chips as c (c)}<li><button type="button" onclick={() => addChip(c)}>{c}</button></li>{/each}</ul>
    {/if}
  {/if}
  {#snippet actions()}
    {#if view === "drafted"}
      <Button onclick={() => onuse?.(words)}>{t("develop.use")}</Button>
      <Button variant="text" icon="edit" onclick={onwrite}>{t("develop.writeOwn")}</Button>
    {:else if view === "developing"}
      <!-- While Gemma writes, writing your own is one tap away (fresh-eyes round 4). -->
      <Button variant="text" icon="edit" onclick={onwrite}>{t("develop.writeOwn")}</Button>
    {:else}
      <Button disabled={!own.trim() || tooLong} onclick={() => onuse?.(own.trim())}>{t("develop.useMine")}</Button>
    {/if}
  {/snippet}
  {#snippet overlay()}
    {#if askLocation}
      <Sheet inline title={t("perm.locationHost.title")} description={t("perm.locationHost.body")}>
        <Button icon="hotspots" onclick={onallowlocation}>{t("perm.locationHost.allow")}</Button>
        <TextField label={t("perm.locationHost.label")} bind:value={typedSpot} placeholder={t("perm.locationHost.placeholder")} max={80} />
        <Button variant="text" onclick={onskiplocation}>{t("perm.locationHost.alt")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .spot { display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 700; }
  .pending { color: var(--text-muted); animation: breathe 1.6s var(--ease-in-out) infinite; margin: 0; }
  .tier, .notice { margin: 0; display: flex; gap: 6px; align-items: center; }
  .cloud { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .cloud p { margin: 0; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chips button { min-height: 44px; padding: 8px 14px; border-radius: var(--r-pill); border: 2px solid var(--line); background: var(--surface); color: var(--text); font: inherit; font-weight: 700; }
  @keyframes breathe { 50% { opacity: 0.5; } }
  @media (prefers-reduced-motion: reduce) { .pending { animation: none; } }
</style>
