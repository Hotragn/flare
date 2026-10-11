<!-- P1 Plan: ask. A planned ask for later, with a start time and an answer-by deadline (SRS-PLAN-1, BR-P-1 to -3). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Choice from "../components/Choice.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    theme = "light",
    ask = $bindable(""),
    quorum = $bindable("3"),
    start = $bindable(""), // datetime-local value in the group zone
    deadline = $bindable(""),
    error = "",
    offline = false,
    ondraft,
    onclose,
  }: {
    theme?: Theme;
    ask?: string;
    quorum?: string;
    start?: string;
    deadline?: string;
    error?: string;
    offline?: boolean;
    ondraft?: () => void;
    onclose?: () => void;
  } = $props();
</script>

<Screen {theme} {onclose} heading={t("plan.title")} title={t("plan.title")} offline={offline ? t("plan.offline") : ""}>
  <TextField label={t("plan.askLabel")} bind:value={ask} placeholder={t("plan.askPlaceholder")} max={60} />
  <div class="times">
    <label class="time"><span class="lbl">{t("plan.starts")}</span><span class="pick"><Icon name="plan" size={20} /><input type="datetime-local" bind:value={start} aria-label={t("plan.pickStart")} /></span></label>
    <label class="time"><span class="lbl">{t("plan.answersBy")}</span><span class="pick" class:bad={!!error}><Icon name="plan" size={20} /><input type="datetime-local" bind:value={deadline} aria-label={t("plan.pickDeadline")} /></span></label>
  </div>
  {#if error}<p class="err" role="alert"><Icon name="warning" />{error}</p>{/if}
  <Choice label={t("send.quorumLabel")} bind:value={quorum} options={["2", "3", "4", "5", "6"].map((v) => ({ value: v, label: v }))} />
  <p class="t-small t-muted">{t("plan.next")}</p>
  {#snippet actions()}
    <Button onclick={ondraft} disabled={!ask.trim() || !!error}>{t("plan.draft")}</Button>
  {/snippet}
</Screen>

<style>
  p { margin: 0; }
  .times { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .time { display: flex; flex-direction: column; gap: 6px; }
  .lbl { font-weight: 700; }
  .pick { min-height: 48px; display: flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: var(--r-md); border: 2px solid var(--text-muted); background: var(--surface); }
  .pick input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--text); font: inherit; font-weight: 700; }
  .bad { border-color: var(--c-ember-700); }
  .err { display: flex; gap: 8px; align-items: center; font-weight: 700; }
</style>
