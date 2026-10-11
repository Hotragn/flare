<!-- O4 Phone check (/check, SRS-CAP-1). Sample values; the real page reads them live. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let { view = "report", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const rows: [string, string, boolean | null][] = [
    [t("check.row.os"), "iOS 26.0 · Safari 26", true],
    [t("check.row.gpu"), t("check.val.gpu"), true],
    [t("check.row.storage"), t("check.val.free", { gb: "11.2" }), true],
    [t("check.row.location"), t("check.val.allowed"), true],
    [t("check.row.compass"), t("check.val.tap"), null],
    [t("check.row.speech"), t("check.val.voices", { n: 4 }), true],
    [t("check.row.push"), t("check.val.homeScreen"), false],
  ];
  const limits = rows.filter((r) => r[2] !== true).length;
</script>

<Screen {theme} {wire} title={t("check.title")}>
  <h1 class="t-title">{view === "running" ? t("check.running") : limits ? t("check.limits", { n: limits }) : t("check.ready")}</h1>
  <ul class="checks" aria-busy={view === "running"}>
    {#each rows as [label, value, ok], i}
      <li>
        <span class="mark" class:ok={ok === true} class:warn={ok === null} class:no={ok === false} aria-hidden="true">{view === "running" && i > 2 ? "…" : ok === true ? "✓" : ok === null ? "!" : "×"}</span>
        <span class="lbl">{label}</span>
        <span class="val t-small">{view === "running" && i > 2 ? t("check.val.checking") : value}</span>
      </li>
    {/each}
  </ul>
  {#if view !== "running"}
    <p class="tier"><Icon name="info" size={20} /><span>{t("check.tier1")} {t("check.tier2")}</span></p>
  {/if}
  {#snippet actions()}<Button disabled={view === "running"}>{t("check.copy")}</Button>{/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
  .checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  li { display: grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items: center; min-height: 52px; border-bottom: 1px solid var(--line); }
  .mark { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; background: var(--line); }
  .ok { background: var(--positive); color: var(--bg); }
  .warn { background: var(--c-gold-400); color: var(--c-ink-900); }
  .no { background: var(--c-ember-700); color: var(--c-birch-50); }
  .lbl { font-weight: 700; }
  .val { text-align: right; }
  .tier { display: flex; gap: 8px; align-items: flex-start; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); }
</style>
