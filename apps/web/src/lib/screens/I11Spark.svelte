<!-- I11 Spark: one line in your own words, once, optional (BR-K-1 to -3). No AI help offered:
     "Say it" (ADR-0027) only turns the person's own words into text, for them to edit. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "empty",
    theme = "light",
    line = $bindable(""),
    error = "",
    busy = false,
    canSay = false,
    onsave,
    onskip,
  }: {
    view?: "empty" | "saved";
    theme?: Theme;
    line?: string;
    error?: string;
    busy?: boolean;
    /** The server has Voice Spark and this phone can record (lib/voice/spark.ts). */
    canSay?: boolean;
    onsave?: (line: string) => void;
    onskip?: () => void;
  } = $props();
  let sayError = $state("");
</script>

<Screen {theme} onclose={onskip}>
  {#if view === "saved"}
    <div class="center">
      <Icon name="spark" size={56} />
      <h1 class="t-title">{t("spark.saved")}</h1>
      <p>{t("spark.savedBody")}</p>
    </div>
  {:else}
    <div class="intro">
      <Icon name="spark" size={40} />
      <h1 class="t-title">{t("spark.prompt")}</h1>
      <p class="t-muted">{t("spark.body")}</p>
    </div>
    <TextField label={t("spark.label")} bind:value={line} placeholder={t("spark.placeholder")} error={error || sayError} max={140} multiline />
    {#if canSay}
      <!-- Loaded only when the server offers it, so the link page stays in its JS budget. -->
      {#await import("../components/SaySpark.svelte") then { default: SaySpark }}<SaySpark bind:line bind:error={sayError} />{/await}
    {/if}
  {/if}
  {#snippet actions()}
    {#if view === "saved"}
      <Button variant="secondary" onclick={onskip}>{t("gone.close")}</Button>
    {:else}
      <Button loading={busy} onclick={() => onsave?.(line.trim())} disabled={!line.trim()}>{t("spark.save")}</Button>
      <Button variant="text" onclick={onskip}>{t("spark.skip")}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .intro { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; color: var(--text); }
  .intro h1, .intro p, .center h1, .center p { margin: 0; }
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
</style>
