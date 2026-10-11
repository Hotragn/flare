<!-- I1 Invite: what a friend sees from the link. One button, private, no No (SRS-RES-1, -5, -8). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import CountRing from "../components/CountRing.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import Icon from "../components/Icon.svelte";
  import Flame from "../components/Flame.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { InviteInfo, Theme } from "../components/parts";
  let {
    view = "kindling",
    theme = "light",
    info = null,
    have = 1,
    quorum = 2,
    error = "",
    busy = false,
    sample = false,
    canCondition = true,
    onyes,
    oncondition,
    onclose,
  }: {
    view?: "kindling" | "loading" | "missing-key" | "lit" | "gone";
    theme?: Theme;
    info?: InviteInfo | null;
    have?: number;
    quorum?: number;
    error?: string;
    busy?: boolean;
    sample?: boolean;
    canCondition?: boolean;
    onyes?: () => void;
    oncondition?: () => void;
    onclose?: () => void;
  } = $props();
  const host = $derived(info?.host ?? "");
  const where = $derived(
    info
      ? info.walkMin !== null
        ? t("invite.whereWalk", { host, spot: info.spot, walk: t("invite.walk", { min: info.walkMin }) })
        : t("invite.where", { host, spot: info.spot })
      : "",
  );
</script>

<Screen {theme} sound {onclose} title={host ? t("invite.title", { host }) : ""} heading={view === "loading" ? t("app.loading") : ""}
  stage={(view === "kindling" || view === "lit") && !!info} backdrop={info?.photo ?? ""} backdropAlt={info?.scene ?? ""}>
  {#snippet hero()}
    {#if info && (view === "kindling" || view === "lit")}
      <h1 class="t-invite words">{info.words}</h1>
    {/if}
  {/snippet}
  {#if view === "loading"}
    <div class="skeleton print-sk" aria-hidden="true"></div>
    <div class="skeleton line" aria-hidden="true"></div>
    <div class="skeleton line short" aria-hidden="true"></div>
  {:else if view === "missing-key"}
    <div class="center">
      <Icon name="warning" size={48} />
      <h1 class="t-title">{t("invite.missingKey")}</h1>
      {#if host}<p class="t-muted">{t("invite.missingKeyHelp", { host })}</p>{/if}
    </div>
  {:else if view === "gone"}
    <div class="center">
      <Flame state="gone" size={120} />
      <h1 class="t-title">{t("gone.title")}</h1>
      <p class="t-muted">{t("gone.body")}</p>
    </div>
  {:else if info}
    <div class="where">
      <Icon name="hotspots" size={22} />
      <div>
        <p>{where}</p>
        {#if info.met}
          <p class="spark t-small"><Icon name="spark" size={18} /><span>{t("invite.metHere", { n: info.met.times })}{#if info.met.line} {t("invite.sparkQuote", { line: info.met.line })}{/if}</span></p>
        {/if}
      </div>
    </div>
    <CountRing {have} {quorum} lit={view === "lit"} />
    <InfoLines access={info.access} nature={info.nature} compact />
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  {/if}
  {#snippet actions()}
    {#if (view === "kindling" || view === "lit") && info}
      <Button icon="here" haptic="tap" loading={busy} onclick={onyes}>{t("invite.yes")}</Button>
      {#if canCondition}<Button variant="text" onclick={oncondition}>{t("invite.condition")}</Button>{/if}
    {:else if view === "missing-key" || view === "gone"}
      <Button variant="secondary" onclick={onclose}>{t("gone.close")}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .words { margin: 0; font-size: calc(2.5rem * var(--text-scale)); line-height: 1.08; max-width: 14ch; }
  .where { display: flex; gap: 8px; align-items: flex-start; }
  .where p { margin: 0; }
  .spark { display: flex; gap: 6px; align-items: center; color: var(--accent-text); font-weight: 700; margin-top: 4px !important; }
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .err { margin: 0; color: var(--text); font-weight: 700; }
  .skeleton { background: color-mix(in srgb, var(--text) 9%, transparent); border-radius: var(--r-md); animation: pulse 1.4s var(--ease-in-out) infinite; }
  .print-sk { height: 300px; }
  .line { height: 32px; }
  .short { width: 60%; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
