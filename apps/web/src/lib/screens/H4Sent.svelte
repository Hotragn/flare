<!-- H4 Sent. The share sheet opens on its own; this screen tells the host to put the phone away (SRS-CRE-8, -9, SRS-IF-6). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  import { sentBodyKey, type Buzz } from "#lib/push/buzz.ts";
  let {
    theme = "light",
    kind = "flare",
    deadline = "",
    copied = false,
    buzz = "open",
    installed = false,
    ondone,
    onshare,
    linkOnly = false,
    shareFirst = false,
    oncopy,
  }: {
    theme?: Theme;
    kind?: "flare" | "plan";
    deadline?: string;
    copied?: boolean;
    /** What will really tell the host it lit (live bug 5): push, Telegram, or this open page. */
    buzz?: Buzz;
    installed?: boolean;
    ondone?: () => void;
    onshare?: () => void;
    /** No share sheet in this browser: Share copies the link. */
    linkOnly?: boolean;
    /** Share is the main button (not linked to Telegram). */
    shareFirst?: boolean;
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
      <h1 class="t-display">{t(shareFirst ? "sent.titleShare" : "sent.title")}</h1>
      <p class="t-sun">{t(sentBodyKey(buzz))}</p>
      {#if buzz !== "push" && !installed}
        <details class="home">
          <summary>{t("sent.homeTitle")}</summary>
          <ol><li>{t("sent.homeStep1")}</li><li>{t("sent.homeStep2")}</li></ol>
        </details>
      {/if}
      <p class="t-muted">{t("sent.shrinkNote")}</p>
    {/if}
    {#if copied}<p class="t-small" role="status">{t("sent.copied")}</p>{/if}
  </div>
  {#snippet actions()}
    {@const share = t(linkOnly ? "share.copyLink" : "sent.shareAgain")}
    <!-- shareFirst: the Flare exists and the link is ready, so this tap opens the sheet at once. -->
    {#if shareFirst}<Button icon="share" onclick={onshare}>{share}</Button>{:else}<Button onclick={ondone}>{t("sent.pocket")}</Button>{/if}
    <div class="row">
      {#if shareFirst}<Button variant="text" onclick={ondone}>{t("sent.pocket")}</Button>{:else}<Button variant="text" icon="share" onclick={onshare}>{share}</Button>{/if}
      <Button variant="text" onclick={oncopy}>{t("sent.copyText")}</Button>
    </div>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 24ch; }
  .home { max-width: 30ch; text-align: left; }
  .home summary { min-height: 44px; display: flex; align-items: center; justify-content: center; font-weight: 700; cursor: pointer; }
  .home ol { margin: 0; padding-left: 1.2em; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
