<!-- I4 You're in. Shown within 500 ms of the tap (SRS-RES-3); take it back before Lit (SRS-RES-6). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import NeedCount from "../components/NeedCount.svelte";
  import { t } from "#lib/copy/index.ts";
  import { kindlingProgress } from "#lib/motion/core.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "success",
    theme = "light",
    have = 1,
    quorum = 2,
    error = "",
    canTakeBack = true,
    doneLabel = "",
    ondone,
    ontakeback,
  }: {
    view?: "success" | "queued" | "taken-back";
    theme?: Theme;
    have?: number;
    quorum?: number;
    error?: string;
    canTakeBack?: boolean;
    /** The demo says where Done goes ("Back to you"). */
    doneLabel?: string;
    ondone?: () => void;
    ontakeback?: () => void;
  } = $props();
</script>

<Screen {theme} sound close={false} offline={view === "queued" ? t("app.offlineQueued") : ""}>
  <div class="center">
    {#if view === "taken-back"}
      <Hearth state="kindling" progress={kindlingProgress(have, quorum)} size={160} />
      <h1 class="t-title">{t("in.takenBack")}</h1>
    {:else}
      <Hearth state="kindling" progress={kindlingProgress(have, quorum)} size={200} intro />
      <h1 class="t-display">{t("in.title")}</h1>
      <p class="t-sun">{t("in.body")}</p>
      <NeedCount {have} {quorum} />
      <p class="t-muted t-small">{t("in.private")}</p>
    {/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>{doneLabel || t("sent.pocket")}</Button>
    {#if view !== "taken-back" && canTakeBack}<Button variant="text" onclick={ontakeback}>{t("in.takeBack")}</Button>{/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; }
  .center h1, .center p { margin: 0; }
  .err { font-weight: 700; }
</style>
