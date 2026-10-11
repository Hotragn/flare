<!-- P5 Plan lit at a step (sun mode). "I'm fading" makes it one step smaller, privately (BR-P-7). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import Ladder from "../components/Ladder.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Step, Theme } from "../components/parts";
  let {
    theme = "sun",
    ask,
    steps,
    current,
    start,
    smaller = false,
    canFade = false,
    stillComing = false,
    savedAt = "",
    onfind,
    onfade,
    onclose,
  }: {
    theme?: Theme;
    ask: string;
    steps: Step[];
    current: number; // 1 to 4
    start: string; // "11:00 AM"
    smaller?: boolean;
    canFade?: boolean;
    stillComing?: boolean; // a fade broke one of your own rules (ADR-0016)
    savedAt?: string;
    onfind?: () => void;
    onfade?: () => void;
    onclose?: () => void;
  } = $props();
  const name = $derived(steps[current - 1]?.name ?? "");
</script>

<Screen {theme} sound {onclose} title={ask} offline={savedAt ? t("app.offline", { time: savedAt }) : ""}>
  <Hearth state="lit" size={130} celebrate={!smaller && !savedAt} horizon={false} />
  <h1 class="t-title center">{smaller ? t("planLit.smaller", { step: name }) : t("planLit.on", { step: name, time: start })}</h1>
  {#if stillComing}<p class="t-sun center" role="status">{t("fade.stillComing", { step: name })}</p>{/if}
  <Ladder {steps} {current} />
  {#snippet actions()}
    <Button icon="compass" onclick={onfind}>{t("lit.find")}</Button>
    {#if current < 4 && canFade}<Button variant="text" onclick={onfade}>{t("planLit.fade")}</Button>{/if}
  {/snippet}
</Screen>

<style>
  .center { text-align: center; margin: 0; }
</style>
