<!-- I5 This spot may not suit you. Private to this person; their yes moves to the Ember (SRS-ACC-3). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare, people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "prompt", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} title={t("invite.title", { host: people.host })}>
  <PhotoPrint scene={flare.scene} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title={t("notSuit.title")} description={t("notSuit.body")}>
      <ul class="why">
        <li><Icon name="steps" /><span>{t("notSuit.steps")}</span></li>
        <li><Icon name="bench" /><span>{t("notSuit.bench", { m: 320 })}</span></li>
      </ul>
      <p class="t-sun">{t("notSuit.ask")}</p>
      <Button>{t("notSuit.yes")}</Button>
      <Button variant="text">{t("notSuit.no")}</Button>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .why { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-weight: 700; }
  .why li { display: flex; gap: 8px; align-items: center; }
  .t-sun { margin: 0; }
</style>
