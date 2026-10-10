<!-- P1 Plan: ask. A planned ask for later, with a time and an answer-by deadline (SRS-PLAN-1). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Choice from "../components/Choice.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "typing", theme = "light", wire = false, ondraft }: { view?: string; theme?: Theme; wire?: boolean; ondraft?: () => void } = $props();
  let ask = $state("");
  let quorum = $state("3");
  $effect(() => { ask = view === "empty" ? "" : plan.ask; });
</script>

<Screen {theme} {wire} heading={t("plan.title")} title={t("plan.title")} offline={view === "offline" ? t("plan.offline") : ""}>
  <TextField label={t("plan.askLabel")} bind:value={ask} placeholder={t("plan.askPlaceholder")} mic max={60} />
  <div class="times">
    <div class="time"><span class="lbl">{t("plan.starts")}</span><button class="pick"><Icon name="plan" size={20} />{plan.startLabel}</button></div>
    <div class="time"><span class="lbl">{t("plan.answersBy")}</span><button class="pick" class:bad={view === "deadline-error"}><Icon name="plan" size={20} />{view === "deadline-error" ? plan.deadlineBadLabel : plan.deadlineLabel}</button></div>
  </div>
  {#if view === "deadline-error"}<p class="err" role="alert"><Icon name="warning" />{t("plan.err.tooClose")}</p>{/if}
  <Choice label={t("send.quorumLabel")} bind:value={quorum} options={["2", "3", "4", "5", "6"].map((v) => ({ value: v, label: v }))} />
  <p class="t-small t-muted">{t("plan.next")}</p>
  {#snippet actions()}
    <Button onclick={ondraft} disabled={!ask || view === "deadline-error"}>{t("plan.draft")}</Button>
  {/snippet}
</Screen>

<style>
  .times { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .time { display: flex; flex-direction: column; gap: 6px; }
  .lbl { font-weight: 700; }
  .pick { min-height: 52px; display: flex; gap: 8px; align-items: center; padding: 0 12px; border-radius: var(--r-md); border: 2px solid var(--text-muted); background: var(--surface); font-weight: 700; }
  .pick.bad { border-color: var(--c-ember-700); }
  .err { display: flex; gap: 8px; align-items: center; margin: 0; font-weight: 700; }
  p { margin: 0; }
</style>
