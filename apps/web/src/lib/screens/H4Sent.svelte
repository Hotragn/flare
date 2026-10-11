<!-- H4 Sent. The share sheet opens on its own; this screen tells the host to put the phone away (SRS-CRE-8, -9, SRS-IF-6). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    theme = "light",
    kind = "flare",
    deadline = "",
    copied = false,
    ondone,
    onshare,
    oncopy,
  }: {
    theme?: Theme;
    kind?: "flare" | "plan";
    deadline?: string;
    copied?: boolean;
    ondone?: () => void;
    onshare?: () => void;
    oncopy?: () => void;
  } = $props();
</script>

<Screen {theme} close={false}>
  <div class="center">
    <Hearth state="kindling" progress={0.15} size={170} />
    {#if kind === "plan"}
      <h1 class="t-display">{t("planSent.title")}</h1>
      <p class="t-sun">{t("planSent.body", { deadline })}</p>
    {:else}
      <h1 class="t-display">{t("sent.title")}</h1>
      <p class="t-sun">{t("sent.body")}</p>
      <p class="t-muted">{t("sent.shrinkNote")}</p>
    {/if}
    {#if copied}<p class="t-small" role="status">{t("sent.copied")}</p>{/if}
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>{t("sent.pocket")}</Button>
    <div class="row">
      <Button variant="text" icon="share" onclick={onshare}>{t("sent.shareAgain")}</Button>
      <Button variant="text" onclick={oncopy}>{t("sent.copyText")}</Button>
    </div>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 24ch; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
