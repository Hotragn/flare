<!-- O2 My needs: set once, stored only on this phone (BR-A-1). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Choice from "../components/Choice.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let { view = "set", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  let steps = $state("yes");
  let rest = $state("200");
  let wc = $state("yes");
  $effect(() => { if (view === "empty") { steps = ""; rest = ""; wc = ""; } });
  const yesNo = [{ value: "yes", label: t("needs.yes") }, { value: "no", label: t("needs.no") }];
</script>

<Screen {theme} {wire} heading={t("needs.title")} title={t("needs.title")}>
  <p class="lock"><Icon name="info" size={20} /><span>{t("needs.lock")}</span></p>
  <Choice label={t("needs.steps")} bind:value={steps} options={yesNo} />
  <Choice label={t("needs.rest")} bind:value={rest} options={[{ value: "100", label: t("needs.m100") }, { value: "200", label: t("needs.m200") }, { value: "400", label: t("needs.m400") }, { value: "none", label: t("needs.none") }]} />
  <Choice label={t("needs.restroom")} bind:value={wc} options={yesNo} />
  <p class="t-small t-muted">{view === "empty" ? t("needs.empty") : t("needs.foot")}</p>
  {#snippet actions()}<Button>{t("needs.save")}</Button>{/snippet}
</Screen>

<style>
  .lock { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); font-weight: 700; }
  p { margin: 0; }
</style>
