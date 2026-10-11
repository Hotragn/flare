<!-- W2 How it works: three steps with the print, the flame meter and the lit flame. -->
<script lang="ts">
  import PhotoPrint from "#lib/components/PhotoPrint.svelte";
  import FlameMeter from "#lib/components/FlameMeter.svelte";
  import Flame from "#lib/components/Flame.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare } from "#lib/sample.ts";
  let { heading = "h2" }: { heading?: "h1" | "h2" } = $props();
  const sub = $derived(heading === "h1" ? "h2" : "h3");
</script>

<svelte:element this={heading} class="t-title">{t("site.how.title")}</svelte:element>
<ol class="steps">
  <li>
    <div class="art" aria-hidden="true"><PhotoPrint scene={flare.scene} height={200} tilt={-2} /></div>
    <svelte:element this={sub} class="t-heading"><span class="n" aria-hidden="true">1</span> {t("site.how.s1.title")}</svelte:element>
    <p>{t("site.how.s1.body")}</p>
  </li>
  <li>
    <div class="art meter" aria-hidden="true"><FlameMeter have={2} quorum={3} /></div>
    <svelte:element this={sub} class="t-heading"><span class="n" aria-hidden="true">2</span> {t("site.how.s2.title")}</svelte:element>
    <p>{t("site.how.s2.body")}</p>
  </li>
  <li>
    <div class="art" aria-hidden="true"><Flame state="lit" size={150} /></div>
    <svelte:element this={sub} class="t-heading"><span class="n" aria-hidden="true">3</span> {t("site.how.s3.title")}</svelte:element>
    <p>{t("site.how.s3.body")}</p>
  </li>
</ol>
