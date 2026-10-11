<!-- H5 Host, Kindling (sun mode). The flame grows with each yes; only the count (BR-Q-5). Text yes and Cancel (SRS-CH-5). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import CountRing from "../components/CountRing.svelte";
  import Sheet from "../components/Sheet.svelte";
  import TextField from "../components/TextField.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    photo = "",
    scene = "",
    view = "growing",
    theme = "sun",
    have = 1,
    quorum = 2,
    sentMin = 0,
    shrinkMin = null,
    hostLine = "",
    code = "",
    textYesUsed = 0,
    savedAt = "",
    error = "",
    busy = false,
    ontextyes,
    oncancel,
    onshare,
    onclose,
  }: {
    /** The Flare photo behind the screen (2026 direction); the warm light when there is none. */
    photo?: string;
    scene?: string;
    view?: "zero" | "growing" | "near" | "offline" | "text-yes" | "cancel";
    theme?: Theme;
    have?: number;
    quorum?: number;
    sentMin?: number;
    shrinkMin?: number | null;
    hostLine?: string;
    code?: string;
    textYesUsed?: number;
    savedAt?: string;
    error?: string;
    busy?: boolean;
    ontextyes?: (code: string) => void;
    oncancel?: () => void;
    onshare?: () => void;
    onclose?: () => void;
  } = $props();
  // svelte-ignore state_referenced_locally
  let sheet = $state<"" | "text-yes" | "cancel">(view === "text-yes" || view === "cancel" ? view : "");
  let reply = $state("");
</script>

<Screen {theme} sound {onclose} heading={t("host.kindling.heading")} title={t("host.kindling.title")} offline={savedAt ? t("app.offline", { time: savedAt }) : ""} stage backdrop={photo} backdropAlt={scene} fallbackArt>
  {#snippet hero()}
    <div class="center">
      <CountRing {have} {quorum} size={190} />
      <p class="t-muted">{shrinkMin === null || have <= 1 ? (sentMin < 1 ? t("host.kindling.justSent") : t("host.kindling.sentAgo", { min: sentMin })) : t("host.kindling.shrinkIn", { min: shrinkMin })}</p>
    </div>
  {/snippet}
  {#if hostLine}<p class="hostline t-small">{hostLine}</p>{/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#snippet actions()}
    <div class="row">
      <Button variant="secondary" icon="share" onclick={onshare}>{t("sent.shareAgain")}</Button>
      <Button variant="secondary" onclick={() => (sheet = "text-yes")}>{t("host.textYes.open")}</Button>
    </div>
    <Button variant="text" onclick={() => (sheet = "cancel")}>{t("host.kindling.cancel")}</Button>
  {/snippet}
  {#snippet overlay()}
    {#if sheet === "cancel"}
      <Sheet inline title={t("host.cancel.title")} description={t("host.cancel.body")}>
        <Button variant="danger" loading={busy} onclick={() => { sheet = ""; oncancel?.(); }}>{t("host.cancel.yes")}</Button>
        <Button variant="text" onclick={() => (sheet = "")}>{t("host.cancel.no")}</Button>
      </Sheet>
    {:else if sheet === "text-yes"}
      <Sheet inline title={t("host.textYes.open")}>
        {#if textYesUsed >= 3}
          <p role="status">{t("host.textYes.max")}</p>
        {:else}
          <TextField label={t("host.textYes.label")} bind:value={reply} hint={t("host.textYes.hint", { code })} max={12} />
          <Button loading={busy} disabled={!reply.trim()} onclick={() => { ontextyes?.(reply); reply = ""; sheet = ""; }}>{t("host.textYes.add")}</Button>
        {/if}
        <Button variant="text" onclick={() => (sheet = "")}>{t("app.close")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center p { margin: 0; }
  .hostline { margin: 0; text-align: center; color: var(--text-muted); font-weight: 700; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .err { font-weight: 700; margin: 0; text-align: center; }
</style>
