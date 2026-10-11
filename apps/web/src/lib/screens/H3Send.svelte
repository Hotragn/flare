<!-- H3 Send it: quorum (the only setting, SRS-CRE-5), host line, and what's near (SRS-CRE-4). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import Choice from "../components/Choice.svelte";
  import TextField from "../components/TextField.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Access, Theme } from "../components/parts";
  let {
    view = "ready",
    theme = "light",
    photo = "",
    scene = "",
    words,
    quorum = $bindable("2"),
    hostLine = $bindable(""),
    hostName = $bindable(""),
    askName = false,
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
    quorum?: string;
    hostLine?: string;
    hostName?: string;
    askName?: boolean; // first Flare on this phone: the host's own first name (sealed)
    access?: Access | null;
    nature?: string;
    error?: string;
    sample?: boolean;
    onsend?: () => void;
    onclose?: () => void;
  } = $props();
  let editing = $state(false);
  const showEdit = $derived(editing || view === "editing");
</script>

<Screen {theme} {onclose} heading={t("send.title")} title={t("send.title")} offline={view === "offline" ? t("send.offline") : ""}>
  <div class="top">
    <div class="thumb"><PhotoPrint {scene} src={photo} {sample} height={150} tilt={-3} /></div>
    <p class="t-title words">{words}</p>
  </div>
  {#if askName}
    <TextField label={t("join.nameLabel")} bind:value={hostName} placeholder={t("join.namePlaceholder")} hint={t("join.nameHint")} max={24} />
  {/if}
  <Choice label={t("send.quorumLabel")} bind:value={quorum} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
  {#if showEdit}
    <TextField label={t("send.hostLineLabel")} bind:value={hostLine} hint={t("send.hostLineHint")} max={80} />
  {:else}
    <p class="hostline"><span>{hostLine}</span><button class="edit" aria-label={t("send.hostLineEdit")} onclick={() => (editing = true)}><Icon name="edit" /></button></p>
  {/if}
  <InfoLines {access} {nature} />
  {#if view === "error" || error}
    <p class="err" role="alert"><Icon name="warning" />{error || t("err.network")}</p>
  {/if}
  {#snippet actions()}
    <Button icon="share" loading={view === "sending"} disabled={askName && !hostName.trim()} onclick={onsend}>{view === "error" ? t("err.retry") : view === "offline" ? t("send.later") : t("send.cta")}</Button>
  {/snippet}
</Screen>

<style>
  .top { display: flex; gap: 14px; align-items: center; }
  .thumb { width: 116px; flex: none; }
  .words { margin: 0; }
  .hostline { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; padding: 12px 6px 12px 14px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line); font-weight: 700; }
  .edit { width: 44px; height: 44px; flex: none; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; color: var(--text); }
  .err { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); border: 2px solid var(--c-ember-700); font-weight: 700; }
</style>
