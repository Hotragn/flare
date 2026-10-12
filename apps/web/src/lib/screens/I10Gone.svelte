<!-- I10 Not this time: the same words for everyone (SRS-ST-3). The ember cools and ash drifts
     up once, under the live sky. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let { theme = "light", onclose, sky = undefined }: { theme?: Theme; onclose?: () => void; sky?: import("#lib/motion/sky.ts").SkyInput } = $props();
</script>

<Screen {theme} close={false} stage fallbackArt {sky} heading={t("gone.title")}>
  {#snippet hero()}
    <div class="center">
      <Hearth state="gone" size={150} cool horizon={false} />
    </div>
  {/snippet}
  <p class="t-display title" aria-hidden="true">{t("gone.title")}</p>
  <p>{t("gone.body")}</p>
  {#snippet actions()}
    <Button variant="secondary" onclick={onclose}>{t("gone.close")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  p { margin: 0; text-align: center; }
  .title { font-size: calc(2rem * var(--text-scale)); }
</style>
