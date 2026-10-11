<!-- Home (W1 hero, W2 steps, W3 shrink, then short W4 to W6 with links to the full pages). -->
<script lang="ts">
  import Scenery from "#lib/components/Scenery.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t, type CopyKey } from "#lib/copy/index.ts";
  import Seo from "./Seo.svelte";
  import Steps from "./Steps.svelte";
  import Shrink from "./Shrink.svelte";
  import { reveal } from "./reveal.ts";

  const promises: CopyKey[] = ["site.privacy.p1", "site.privacy.p2", "site.privacy.p3", "site.privacy.p4", "site.privacy.p5"];
  const access: [string, CopyKey][] = [["bench", "site.access.a1"], ["steps", "site.access.a2"], ["compass", "site.access.a3"], ["info", "site.access.a4"], ["card", "site.access.a5"]];
</script>

<Seo path="/" />

<section class="hero">
  <div class="hero-art" aria-hidden="true"><Scenery width={1200} height={640} /></div>
  <div class="hero-copy">
    <p class="kicker">{t("site.hero.kicker")}</p>
    <h1 class="t-display">{t("site.hero.title")}</h1>
    <p class="lead">{t("site.hero.lead")}</p>
    <div class="ctas">
      <a class="cta primary" href="/app/">{t("site.nav.open")}</a>
      <a class="cta" href="/app/demo/">{t("demo.try")}</a>
      <a class="cta" href="/how/">{t("site.hero.how")}</a>
    </div>
    <p class="fine">{t("site.hero.fine")}</p>
  </div>
</section>

<section class="band" use:reveal>
  <Steps />
  <p class="more"><a href="/how/">{t("site.home.readHow")}</a></p>
</section>

<section class="band alt" use:reveal>
  <Shrink />
</section>

<section class="band" use:reveal>
  <h2 class="t-title">{t("site.privacy.title")}</h2>
  <ul class="checks">
    {#each promises as key}<li><Icon name="here" /><span>{t(key)}</span></li>{/each}
  </ul>
  <p class="more"><a href="/privacy/">{t("site.home.readPrivacy")}</a></p>
</section>

<section class="band alt" use:reveal>
  <h2 class="t-title">{t("site.access.title")}</h2>
  <ul class="checks">
    {#each access as [icon, key]}<li><Icon name={icon} /><span>{t(key)}</span></li>{/each}
  </ul>
  <p class="more"><a href="/accessibility/">{t("site.home.readAccess")}</a></p>
</section>

<section class="band" use:reveal>
  <h2 class="t-title">{t("site.run.title")}</h2>
  <p>{t("site.run.body")}</p>
  <p class="more"><a href="/run/">{t("site.home.readRun")}</a></p>
</section>
