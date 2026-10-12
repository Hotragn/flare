<!-- Home: W1 hero (with the sunset line), the scroll story (was W2 steps and W3 shrink), Start in a
     minute, Your crew space, At the spot (was the 10-card grid), Try it on your photo, Running now,
     then short W4 to W6 with links to the full pages. -->
<script lang="ts">
  import Scenery from "#lib/components/Scenery.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t, type CopyKey } from "#lib/copy/site.ts";
  import Seo from "./Seo.svelte";
  import Story from "./Story.svelte";
  import SunLine from "./SunLine.svelte";
  import Start from "./Start.svelte";
  import Crew from "./Crew.svelte";
  import Spot from "./Spot.svelte";
  import TryPhoto from "./TryPhoto.svelte";
  import Live from "./Live.svelte";
  import BuiltWith from "./BuiltWith.svelte";
  import { reveal } from "./reveal.ts";

  const promises: CopyKey[] = ["site.privacy.p1", "site.privacy.p2", "site.privacy.p3", "site.privacy.p4", "site.privacy.p5"];
  const access: [string, CopyKey][] = [["bench", "site.access.a1"], ["steps", "site.access.a2"], ["compass", "site.access.a3"], ["info", "site.access.a4"], ["card", "site.access.a5"]];
</script>

<Seo path="/" />

<section class="hero">
  <div class="hero-art" aria-hidden="true"><Scenery width={1200} height={640} /></div>
  <picture class="hero-shot">
    <!-- 150 px wide on phones, 260 px on desktops: the 300 w file covers phones at 2x. -->
    <source type="image/avif" srcset="/site/hero-invite-300.avif 300w, /site/hero-invite.avif 360w" sizes="(min-width: 900px) 260px, 150px" />
    <img src="/site/hero-invite.webp" srcset="/site/hero-invite-300.webp 300w, /site/hero-invite.webp 360w" sizes="(min-width: 900px) 260px, 150px" width="360" height="779" alt={t("site.hero.shotAlt")} fetchpriority="high" decoding="async" />
  </picture>
  <div class="hero-copy">
    <p class="kicker">{t("site.hero.kicker")}</p>
    <h1 class="t-display">{t("site.hero.title")}</h1>
    <p class="lead">{t("site.hero.lead")}</p>
    <div class="ctas">
      <a class="cta primary" href="/app/demo/">{t("demo.try")}</a>
      <a class="cta" href="/app/">{t("site.nav.open")}</a>
    </div>
    <SunLine />
    <p class="fine">{t("site.hero.fine")} <a class="judge" href="/app/demo/">{t("site.hero.judge")}</a></p>
  </div>
</section>

<section class="band story-band">
  <Story />
  <p class="more"><a href="/how/">{t("site.home.readHow")}</a></p>
</section>

<section class="band alt" use:reveal>
  <Start />
</section>

<section class="band" use:reveal>
  <Crew />
</section>

<section class="band alt" use:reveal>
  <Spot />
</section>

<section class="band" use:reveal>
  <TryPhoto />
</section>

<section class="band live-band" use:reveal>
  <Live />
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

<section class="band alt" use:reveal>
  <BuiltWith />
  <p class="more"><a href="/how/#hood">{t("site.home.readBuilt")}</a></p>
</section>

<section class="band" use:reveal>
  <h2 class="t-title">{t("site.run.title")}</h2>
  <p>{t("site.run.body")}</p>
  <p class="more"><a href="/run/">{t("site.home.readRun")}</a></p>
</section>

<style>
  .judge { color: var(--c-birch-50) !important; font-weight: 700; text-underline-offset: 3px; white-space: nowrap; }
</style>
