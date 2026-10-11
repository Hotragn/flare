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
  } = $props();
  let editing = $state(false);
  const showEdit = $derived(editing || view === "editing");
  const shownLine = $derived(hostLine || (hostName.trim() && (spot || typedSpot.trim()) ? t("send.hostLine", { host: hostName.trim(), spot: spot || typedSpot.trim() }) : ""));
</script>

<Screen {theme} {onclose} heading={t("send.title")} title={t("send.title")} offline={view === "offline" ? t("send.offline") : ""}
  stage backdrop={photo} backdropAlt={scene}>
  {#snippet hero()}<p class="t-invite words">{words}</p>{/snippet}
  <Tip id="send" text="tip.send" />
  {#if askName}
    <TextField label={t("join.nameLabel")} bind:value={hostName} placeholder={t("join.namePlaceholder")} hint={t("join.nameHint")} max={24} />
  {/if}
  {#if askSpot}
    <TextField label={t("perm.locationHost.label")} bind:value={typedSpot} placeholder={t("perm.locationHost.placeholder")} max={80} />
  {/if}
  <Choice label={t("send.quorumLabel")} bind:value={quorum} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
  {#if showEdit}
    <TextField label={t("send.hostLineLabel")} bind:value={hostLine} hint={t("send.hostLineHint")} max={80} />
  {:else}
    <p class="hostline"><span>{shownLine}</span><button class="edit" aria-label={t("send.hostLineEdit")} onclick={() => (editing = true)}><Icon name="edit" /></button></p>
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
  .words { margin: 0; font-size: calc(2.5rem * var(--text-scale)); line-height: 1.08; max-width: 14ch; }
  .hostline { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; padding: 4px 0; font-weight: 600; }
  .edit { width: 44px; height: 44px; flex: none; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; color: var(--text); }
  .err { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); border: 2px solid var(--c-ember-700); font-weight: 700; }
</style>
