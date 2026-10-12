<!-- H3 Send it: quorum (the only setting, SRS-CRE-5), host line, and what's near (SRS-CRE-4). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Choice from "../components/Choice.svelte";
  import TextField from "../components/TextField.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import Icon from "../components/Icon.svelte";
  import Tip from "../components/Tip.svelte";
  import { t } from "#lib/copy/index.ts";
  import { lit, zoom } from "#lib/photo-fit.ts";
  import type { Access, Theme } from "../components/parts";
  let {
    view = "ready",
    theme = "light",
    photo = "",
    scene = "",
    words,
    spot = "",
    quorum = $bindable("2"),
    hostLine = $bindable(""),
    hostName = $bindable(""),
    askName = false,
    askSpot = false,
    typedSpot = $bindable(""),
    access = null,
    nature = "",
    error = "",
    sample = false,
    onsend,
    onclose,
      coach = "",
      onlocate,
  }: {
    view?: "ready" | "editing" | "sending" | "error" | "offline";
    theme?: Theme;
    photo?: string;
    scene?: string;
    words: string;
    spot?: string;
    quorum?: string;
    hostLine?: string;
    hostName?: string;
    askName?: boolean; // first Flare on this phone: the host's own first name (sealed)
    askSpot?: boolean; // no spot name from the map: the host types it (perm.locationHost.denied)
    typedSpot?: string;
    access?: Access | null;
    nature?: string;
    error?: string;
    sample?: boolean;
    onsend?: () => void;
    onclose?: () => void;
      /** The demo's coach line, in the sheet so it never covers the photo (fresh-eyes round 6). */
    coach?: string;
      /** Fresh-eyes round 6: the one place we ask for location, next to the place it fills. */
    onlocate?: () => void;
  } = $props();
  let editing = $state(false);
  const showEdit = $derived(editing || view === "editing");
  const shownLine = $derived(hostLine || (hostName.trim() && (spot || typedSpot.trim()) ? t("send.hostLine", { host: hostName.trim(), spot: spot || typedSpot.trim() }) : spot || typedSpot.trim()));
</script>

<Screen {theme} {onclose} heading={t("send.title")} title={t("send.title")} offline={view === "offline" ? t("send.offline") : ""}
  stage fallbackArt={!photo}>
  {#snippet hero()}
    <!-- Photo-fit: the photo is the content, shown whole at the top; words and sheet sit below it. -->
    {#if photo}<button class="pf" type="button" onclick={zoom}><img src={photo} alt={scene || t("invite.photoFallback")} onload={lit} /></button>{/if}
    <p class="t-invite words">{words}</p>
  {/snippet}
  <!-- First send on a short phone: the name field takes the tip's room; the tip shows next time. -->
  {#if coach}<p class="coachline" role="status">{coach}</p>{/if}
  <div class="tipwrap" class:first={askName}><Tip id="send" text="tip.send" /></div>
  <!-- The size first (fresh-eyes round 6): on a small phone it must never sit below the fold. -->
  <Choice label={t("send.quorumLabel")} bind:value={quorum} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
  {#if askName}
    <TextField label={t("join.nameLabel")} bind:value={hostName} placeholder={t("join.namePlaceholder")} hint={t("join.nameHint")} max={24} />
  {/if}
  {#if askSpot}
    <TextField label={t("perm.locationHost.label")} bind:value={typedSpot} placeholder={t("perm.locationHost.placeholder")} hint={typedSpot.trim() ? "" : t("send.whereHint")} max={80} />
    {#if onlocate}<Button variant="text" icon="hotspots" onclick={onlocate}>{t("send.useLocation")}</Button>{/if}
  {/if}
  <!-- One place field (fresh-eyes round 2): when you type where you are, that is the line;
       the Where you'll be row only shows when the map already named the spot. -->
  {#if askSpot && !showEdit}{:else if showEdit}
    <TextField label={t("send.hostLineLabel")} bind:value={hostLine} placeholder={shownLine} hint={t("send.hostLineHint")} max={80} />
  {:else}
    <!-- Fresh-eyes #12: a labelled row with its value and a visible Edit, never a lone pencil. -->
    <div class="hostline">
      <div><p class="lbl t-small">{t("send.hostLineSeen")}</p><p class="val">{shownLine || t("send.hostLineEmpty")}</p></div>
      <button class="edit" aria-label={t("send.hostLineEdit")} onclick={() => {
          if (!hostLine) hostLine = shownLine; // edit the line you see, not an empty box (fresh-eyes round 4)
          editing = true;
        }}><Icon name="edit" size={18} /><span>{t("send.edit")}</span></button>
    </div>
  {/if}
  <InfoLines {access} {nature} />
  {#if view === "error" || error}
    <p class="err" role="alert"><Icon name="warning" />{error || t("err.network")}</p>
  {/if}
  {#snippet actions()}
    <Button icon="share" loading={view === "sending"} disabled={(askName && !hostName.trim()) || (askSpot && !typedSpot.trim())} onclick={onsend}>{view === "error" ? t("err.retry") : view === "offline" ? t("send.later") : t("send.cta")}</Button>
  {/snippet}
</Screen>

<style>
  .tipwrap { display: contents; }
  .coachline { margin: 0; padding: 8px 14px; border-radius: 14px; background: #fff; color: #111; font-weight: 700; }
  .words { margin: 0; font-size: calc(2.5rem * var(--text-scale)); line-height: 1.08; max-width: 14ch; }
  /* Photo-fit: the photo at its own shape, capped so the main button still fits on a 375 x 667
     phone. The words sit under it and the sheet takes the rest, so nothing covers the place. */
  .pf { display: block; margin: 0 auto; padding: 0; border: 0; background: none; border-radius: 16px; overflow: hidden; max-width: 100%; cursor: zoom-in; flex: none; }
  /* Send holds more controls than the invite (size, place, Edit): a smaller print, so every
     control fits at 375 x 667 without scrolling (fresh-eyes round 6). Tap the photo to see it whole. */
  .pf img { display: block; max-width: 100%; max-height: min(24dvh, 300px); width: auto; height: auto; }
  .pf + .words { font-size: calc(1.5rem * var(--text-scale)); max-width: none; }
  @media (max-height: 720px) {
    .pf img { max-height: 15dvh; }
    .tipwrap.first { display: none; }
    .pf + .words { font-size: calc(1.25rem * var(--text-scale)); }
  }
  :global(.staged > .hero:has(.pf)) { flex: none; justify-content: flex-start; gap: 10px; padding-top: 4px; }
  :global(.staged:has(> .hero .pf) > .sheet) { flex: 1; max-height: none; min-height: 0; }
  .hostline { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 0; }
  .hostline p { margin: 0; }
  .lbl { font-weight: 700; opacity: 0.85; }
  .val { font-weight: 600; }
  .edit { min-height: 44px; flex: none; display: inline-flex; gap: 6px; align-items: center; padding: 0 14px; border: 1.5px solid currentColor; border-radius: 999px; background: transparent; color: var(--text); font-weight: 700; }
  .err { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); border: 2px solid var(--c-ember-700); font-weight: 700; }
</style>
