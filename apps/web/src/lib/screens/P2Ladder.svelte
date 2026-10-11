<!-- P2 Ladder: four sizes of the plan, biggest first (BR-P-4). Drafted on the hub (about 3 s) or from a template. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Ladder from "../components/Ladder.svelte";
  import Sheet from "../components/Sheet.svelte";
  import TextField from "../components/TextField.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Step, Theme } from "../components/parts";
  let {
    theme = "light",
    ask,
    steps = $bindable([]),
    tier = "hub",
    drafting = false,
    error = "",
    sending = false,
    onsend,
    onclose,
  }: {
    theme?: Theme;
    ask: string;
    steps?: Step[];
    tier?: "hub" | "rules";
    drafting?: boolean;
    error?: string;
    sending?: boolean;
    onsend?: () => void;
    onclose?: () => void;
  } = $props();
  let editing = $state(-1);
  let name = $state("");
  let minutes = $state(0);
  function edit(i: number) {
    const s = steps[i];
    if (!s) return;
    editing = i;
    name = s.name;
    minutes = s.minutes;
  }
  function save() {
    steps = steps.map((s, i) => (i === editing ? { ...s, name: name.trim() || s.name, minutes: Math.round(minutes) } : s));
    editing = -1;
  }
</script>

<Screen {theme} {onclose} title={ask}>
  <div class="intro">
    <h1 class="t-title">{t("ladder.headline")}</h1>
    <p class="t-muted">{t("ladder.body")}</p>
  </div>
  {#if drafting}
    <ol class="sk" aria-hidden="true">{#each [0, 1, 2, 3] as i (i)}<li></li>{/each}</ol>
    <p class="t-muted" role="status">{t("ladder.drafting")}</p>
  {:else}
    <Ladder {steps} editable {editing} onedit={edit} />
    <p class="t-small t-muted">{tier === "hub" ? t("ladder.madeHub") : t("ladder.madeRules")}</p>
  {/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#snippet actions()}
    <Button icon="share" loading={sending} onclick={onsend} disabled={drafting || !!error}>{t("send.cta")}</Button>
  {/snippet}
  {#snippet overlay()}
    {#if editing >= 0}
      <Sheet inline title={t("ladder.editTitle", { k: editing + 1 })}>
        <TextField label={t("ladder.nameLabel")} bind:value={name} max={40} />
        <label class="mins"><span class="lbl">{t("ladder.minutesLabel")}</span><input type="number" min="5" max="600" step="5" bind:value={minutes} /></label>
        <Button onclick={save}>{t("ladder.save")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .intro { display: flex; flex-direction: column; gap: 6px; }
  .intro h1, .intro p, p { margin: 0; }
  .sk { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .sk li { height: 64px; border-radius: var(--r-md); background: color-mix(in srgb, var(--text) 9%, transparent); animation: pulse 1.4s var(--ease-in-out) infinite; }
  .mins { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .mins input { width: 96px; min-height: 48px; border-radius: var(--r-md); border: 2px solid var(--text-muted); background: var(--surface); color: var(--text); font: inherit; font-weight: 700; padding: 0 10px; }
  .lbl { font-weight: 700; }
  .err { font-weight: 700; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .sk li { animation: none; } }
</style>
