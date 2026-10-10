<!-- P6 I'm fading: confirm privately; everyone sees only "Smaller plan" (BR-P-7). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import Ladder from "../components/Ladder.svelte";
  import { t } from "#lib/copy/index.ts";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "confirm", theme = "sun", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const next = plan.steps[2];
  // The sample Plan lit with 3 people, so the small-group line shows (R19).
  const smallGroup = true;
</script>

<Screen {theme} {wire} title={plan.ask}>
  <Ladder steps={plan.steps} current={view === "notice" ? 3 : 2} />
  {#snippet overlay()}
    {#if view === "confirm"}
      <Sheet inline title={t("fade.title")} description={t("fade.body")}>
        <p class="t-sun">{t("fade.next", { step: next.name, min: next.minutes })}</p>
        {#if smallGroup}<p class="t-small t-muted">{t("fade.smallGroup")}</p>{/if}
        <Button>{t("fade.yes")}</Button>
        <Button variant="text">{t("fade.no")}</Button>
      </Sheet>
    {:else}
      <Sheet inline title={t("planLit.smaller", { step: next.name })}>
        <p class="t-sun">{t("fade.sameSpot", { step: next.name, min: next.minutes })}</p>
        <Button variant="secondary">{t("fade.ok")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .t-sun { margin: 0; }
</style>
