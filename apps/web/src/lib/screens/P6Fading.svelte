<!-- P6 I'm fading: confirm privately; everyone sees only "Smaller plan" (BR-P-7). Small groups get the R19 line. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import Ladder from "../components/Ladder.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Step, Theme } from "../components/parts";
  let {
    view = "confirm",
    theme = "sun",
    ask,
    steps,
    current,
    smallGroup = false,
    samePlace = true,
    error = "",
    busy = false,
    onyes,
    onno,
    onok,
  }: {
    view?: "confirm" | "notice";
    theme?: Theme;
    ask: string;
    steps: Step[];
    current: number; // the lit step now; next is current + 1
    smallGroup?: boolean;
    samePlace?: boolean;
    error?: string;
    busy?: boolean;
    onyes?: () => void;
    onno?: () => void;
    onok?: () => void;
  } = $props();
  const next = $derived(view === "notice" ? steps[current - 1] : steps[current]);
</script>

<Screen {theme} title={ask} onclose={onno}>
  <Ladder {steps} {current} />
  {#snippet overlay()}
    {#if next}
      {#if view === "confirm"}
        <Sheet inline title={t("fade.title")} description={t("fade.body")}>
          <p class="t-sun">{t("fade.next", { step: next.name, min: next.minutes })}</p>
          {#if smallGroup}<p class="t-small t-muted">{t("fade.smallGroup")}</p>{/if}
          {#if error}<p class="err" role="alert">{error}</p>{/if}
          <Button loading={busy} onclick={onyes}>{t("fade.yes")}</Button>
          <Button variant="text" onclick={onno}>{t("fade.no")}</Button>
        </Sheet>
      {:else}
        <Sheet inline title={t("planLit.smaller", { step: next.name })}>
          <p class="t-sun">{samePlace ? t("fade.sameSpot", { step: next.name, min: next.minutes }) : t("fade.newSpot", { place: next.place, min: next.minutes })}</p>
          <Button variant="secondary" onclick={onok}>{t("fade.ok")}</Button>
        </Sheet>
      {/if}
    {/if}
  {/snippet}
</Screen>

<style>
  .t-sun { margin: 0; }
  .err { font-weight: 700; margin: 0; }
</style>
