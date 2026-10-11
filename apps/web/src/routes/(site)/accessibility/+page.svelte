<!-- Accessibility statement (docs/content/05): features, target, what we tested, known gaps,
     why benches, and how to report a barrier. -->
<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import { t, type CopyKey } from "#lib/copy/index.ts";
  import Seo from "../Seo.svelte";
  import { reveal } from "../reveal.ts";

  const access: [string, CopyKey][] = [["bench", "site.access.a1"], ["steps", "site.access.a2"], ["compass", "site.access.a3"], ["info", "site.access.a4"], ["card", "site.access.a5"]];
  const tested: CopyKey[] = ["site.access.t1", "site.access.t2", "site.access.t3"];
  const gaps: CopyKey[] = ["site.access.g1", "site.access.g2", "site.access.g3", "site.access.g4", "site.access.g5"];
</script>

<Seo path="/accessibility/" />

<section class="band page-head">
  <h1 class="t-title">{t("site.access.title")}</h1>
</section>

<section class="band">
  <div class="two">
    <ul class="checks">
      {#each access as [icon, key]}<li><Icon name={icon} /><span>{t(key)}</span></li>{/each}
    </ul>
    <div class="stack">
      <p>{t("site.access.target")}</p>
      <h2 class="t-heading">{t("site.access.testedTitle")}</h2>
      <ul class="plain">{#each tested as key}<li>{t(key)}</li>{/each}</ul>
    </div>
  </div>
</section>

<section class="band alt" use:reveal>
  <h2 class="t-heading">{t("site.access.gapsTitle")}</h2>
  <ul class="plain">{#each gaps as key}<li>{t(key)}</li>{/each}</ul>
</section>

<section class="band" use:reveal>
  <p>
    {t("site.access.why")} {t("site.access.sources")}
    <a href="https://www.netspar.nl/en/knowledge-hub/do-modern-cities-encourage-or-discourage-walking-of-health-impaired-seniors/">{t("site.access.srcNetspar")}</a>,
    <a href="https://data.cdc.gov/resource/s2qv-b27b.json">{t("site.access.srcCdc")}</a>.
  </p>
  <p>{t("site.access.feedback")}</p>
</section>
