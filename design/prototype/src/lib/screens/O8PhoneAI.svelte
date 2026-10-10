<!-- O8 On-phone AI. Lab result (Oct 10): no in-browser vision model fits iPhone Safari
     (1 GiB GPU buffer cap; tabs die near 2 GB). Photo words come from the hub; this
     screen states that honestly and offers the smaller on-phone job when one passes. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import { phoneModel } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "unavailable", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const mb = phoneModel.mb;
</script>

<Screen {theme} {wire} title={t("ai.title")}>
  <h1 class="t-title">{view === "unavailable" ? t("ai.hubHeadline") : view === "ready" ? t("ai.ready") : t("ai.offer")}</h1>
  {#if view === "unavailable"}
    <p>{t("check.tier2")} {t("ai.hubBody")}</p>
    <p class="t-muted t-small">{t("ai.hubFallback")}</p>
  {:else}
    <p>{t("ai.offerBody")}</p>
    <div class="dl">
      <Icon name="info" size={20} />
      <span>{view === "downloading" ? t("ai.downloading", { pct: phoneModel.pct, mb }) : view === "failed" ? t("ai.failed") : t("ai.size", { mb })}</span>
    </div>
    {#if view === "downloading"}<div class="bar" role="progressbar" aria-valuenow={phoneModel.pct} aria-valuemin="0" aria-valuemax="100" aria-label={t("ai.progressAria")}><span style:width="{phoneModel.pct}%"></span></div>{/if}
  {/if}
  {#snippet actions()}
    {#if view === "available"}<Button>{t("ai.download")}</Button>{:else if view === "failed"}<Button>{t("err.retry")}</Button>{:else if view === "downloading"}<Button variant="text">{t("ai.stop")}</Button>{:else}<Button variant="secondary">{t("gone.close")}</Button>{/if}
  {/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
  .dl { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); font-weight: 700; }
  .bar { height: 12px; border-radius: 6px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--lit); }
</style>
