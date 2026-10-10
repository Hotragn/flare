<!--
  The Flare website (W1 to W6), one scroll. Mobile first, two columns from 900 px.
  Every string comes from the copy deck (src/lib/copy/deck.json); every claim
  points to a number or a file. The privacy and accessibility sections are the
  full statements (docs/content/04 and 05).
-->
<script lang="ts">
  import Scenery from "#lib/components/Scenery.svelte";
  import Flame from "#lib/components/Flame.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import PhotoPrint from "#lib/components/PhotoPrint.svelte";
  import FlameMeter from "#lib/components/FlameMeter.svelte";
  import { t, variant, type CopyKey } from "#lib/copy/index.ts";
  import { flare } from "#lib/sample.ts";

  const coords = variant("privacy.coords");
  const rows = ["photo", "yes", coords === "B" ? "coordsB" : "coordsA", "phone", "sparks", "alerts", "counts", "logs"];
  const cell = (row: string, col: "what" | "where" | "when") => t(`site.privacy.row.${row}.${col}` as CopyKey);
  const promises: CopyKey[] = ["site.privacy.p1", "site.privacy.p2", "site.privacy.p3", "site.privacy.p4", "site.privacy.p5"];
  const limits: CopyKey[] = ["site.privacy.l.telegram", "site.privacy.l.guess", "site.privacy.l.sms", "site.privacy.l.link", coords === "B" ? "site.privacy.l.coordsB" : "site.privacy.l.coordsA", "site.privacy.l.hub", "site.privacy.l.push"];
  const access: [string, CopyKey][] = [["bench", "site.access.a1"], ["steps", "site.access.a2"], ["compass", "site.access.a3"], ["info", "site.access.a4"], ["card", "site.access.a5"]];
  const tested: CopyKey[] = ["site.access.t1", "site.access.t2", "site.access.t3"];
  const gaps: CopyKey[] = ["site.access.g1", "site.access.g2", "site.access.g3", "site.access.g4", "site.access.g5"];
</script>

<svelte:head>
  <title>{t("og.site.title")}</title>
  <meta name="description" content={t("og.site.desc")} />
  <meta property="og:title" content={t("og.site.title")} />
  <meta property="og:description" content={t("og.site.desc")} />
  <meta property="og:image" content="/brand/og-image-1200x630.png" />
  <meta property="og:image:alt" content={t("og.site.imageAlt")} />
</svelte:head>

<div class="site" data-theme="light">
  <header class="nav">
    <a href="#top" class="brand" aria-label={t("site.nav.home")}><img src="/brand/flare-lockup-horizontal-light.svg" alt={t("app.name")} width="120" height="44" /></a>
    <nav aria-label={t("site.nav.aria")}>
      <a href="#how">{t("site.nav.how")}</a><a href="#privacy">{t("site.nav.privacy")}</a><a href="#access">{t("site.nav.access")}</a><a href="#run">{t("site.nav.run")}</a>
    </nav>
  </header>

  <main>
  <!-- W1 Hero -->
  <section id="top" class="hero">
    <div class="hero-art" aria-hidden="true"><Scenery width={1200} height={640} /></div>
    <div class="hero-copy">
      <p class="kicker">{t("site.hero.kicker")}</p>
      <h1 class="t-display">{t("site.hero.title")}</h1>
      <p class="lead">{t("site.hero.lead")}</p>
      <div class="ctas">
        <a class="cta primary" href="/proto/">{t("site.hero.try")}</a>
        <a class="cta" href="#how">{t("site.hero.how")}</a>
      </div>
      <p class="fine">{t("site.hero.fine")}</p>
    </div>
  </section>

  <!-- W2 How it works -->
  <section id="how" class="band">
    <h2 class="t-title">{t("site.how.title")}</h2>
    <ol class="steps">
      <li>
        <div class="art"><PhotoPrint scene={flare.scene} height={200} tilt={-2} /></div>
        <h3 class="t-heading"><span class="n">1</span> {t("site.how.s1.title")}</h3>
        <p>{t("site.how.s1.body")}</p>
      </li>
      <li>
        <div class="art meter"><FlameMeter have={2} quorum={3} /></div>
        <h3 class="t-heading"><span class="n">2</span> {t("site.how.s2.title")}</h3>
        <p>{t("site.how.s2.body")}</p>
      </li>
      <li>
        <div class="art"><Flame state="lit" size={150} /></div>
        <h3 class="t-heading"><span class="n">3</span> {t("site.how.s3.title")}</h3>
        <p>{t("site.how.s3.body")}</p>
      </li>
    </ol>
  </section>

  <!-- W3 Shrink -->
  <section class="band alt">
    <h2 class="t-title">{t("site.shrink.title")}</h2>
    <p class="lead">{t("site.shrink.lead")}</p>
    <ul class="states">
      <li><Flame state="kindling" progress={0.5} size={96} /><b>{t("flame.kindling")}</b><span>{t("site.shrink.kindling")}</span></li>
      <li><Flame state="lit" size={96} /><b>{t("flame.lit")}</b><span>{t("site.shrink.lit")}</span></li>
      <li><Flame state="ember" size={96} /><b>{t("flame.ember")}</b><span>{t("site.shrink.ember")}</span></li>
      <li><Flame state="gone" size={96} /><b>{t("flame.gone")}</b><span>{t("site.shrink.gone")}</span></li>
    </ul>
    <p>{t("site.shrink.plan")}</p>
  </section>

  <!-- W4 Privacy: the full statement -->
  <section id="privacy" class="band">
    <h2 class="t-title">{t("site.privacy.title")}</h2>
    <div class="two">
      <ul class="checks">
        {#each promises as key}<li><Icon name="here" /><span>{t(key)}</span></li>{/each}
      </ul>
      <div class="audit">
        <p class="label">{t("site.privacy.auditTitle")}</p>
        <pre><code>{t("site.privacy.audit1")}
{t("site.privacy.audit2")}</code></pre>
      </div>
    </div>
    <h3 class="t-heading">{t("site.privacy.keepTitle")}</h3>
    <ul class="keep">
      {#each rows as row}
        <li>
          <h4>{cell(row, "what")}</h4>
          <dl>
            <dt>{t("site.privacy.colWhere")}</dt><dd>{cell(row, "where")}</dd>
            <dt>{t("site.privacy.colWhen")}</dt><dd>{cell(row, "when")}</dd>
          </dl>
        </li>
      {/each}
    </ul>
    <h3 class="t-heading">{t("site.privacy.limitsTitle")}</h3>
    <ul class="limits">
      {#each limits as key}<li><Icon name="warning" /><span>{t(key)}</span></li>{/each}
    </ul>
  </section>

  <!-- W5 Accessibility: the full statement -->
  <section id="access" class="band alt">
    <h2 class="t-title">{t("site.access.title")}</h2>
    <div class="two">
      <ul class="checks">
        {#each access as [icon, key]}<li><Icon name={icon} /><span>{t(key)}</span></li>{/each}
      </ul>
      <div class="stack">
        <p>{t("site.access.target")}</p>
        <h3 class="t-heading">{t("site.access.testedTitle")}</h3>
        <ul class="plain">{#each tested as key}<li>{t(key)}</li>{/each}</ul>
      </div>
    </div>
    <h3 class="t-heading">{t("site.access.gapsTitle")}</h3>
    <ul class="plain">{#each gaps as key}<li>{t(key)}</li>{/each}</ul>
    <p class="t-small">{t("site.access.why")} {t("site.access.sources")} <a href="https://www.netspar.nl/en/knowledge-hub/do-modern-cities-encourage-or-discourage-walking-of-health-impaired-seniors/">{t("site.access.srcNetspar")}</a> · <a href="https://data.cdc.gov/resource/s2qv-b27b.json">{t("site.access.srcCdc")}</a></p>
    <p>{t("site.access.feedback")}</p>
  </section>

  <!-- W6 Run it yourself -->
  <section id="run" class="band">
    <h2 class="t-title">{t("site.run.title")}</h2>
    <p>{t("site.run.body")}</p>
    <pre><code>git clone https://github.com/Hotragn/flare-outside
cd flare-outside
ollama pull gemma4:e4b
npm ci && npm run dev</code></pre>
    <p class="t-small">{t("site.run.note")}</p>
  </section>

  </main>

  <footer class="foot">
    <img src="/brand/flare-mark-maple.svg" alt="" width="36" height="36" />
    <p>{t("site.foot.made")} {t("site.foot.osm")}</p>
  </footer>
</div>

<style>
  .site { background: var(--bg); color: var(--text); }
  .nav { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: color-mix(in srgb, var(--bg) 94%, transparent); border-bottom: 1px solid var(--line); }
  .nav nav { display: none; gap: 20px; }
  .nav nav a { color: var(--text); font-weight: 700; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
  .hero { position: relative; min-height: 620px; display: grid; align-items: end; overflow: hidden; }
  .hero-art { position: absolute; inset: 0; }
  .hero-copy { position: relative; padding: 32px 20px 40px; color: var(--c-birch-50); max-width: 640px; background: linear-gradient(transparent, rgba(22, 35, 58, 0.85) 30%); }
  .kicker { margin: 0; color: var(--c-gold-300); font-weight: 700; }
  .hero h1 { margin: 8px 0; }
  .lead { font-size: 1.2rem; margin: 0 0 16px; }
  .ctas { display: flex; gap: 10px; flex-wrap: wrap; }
  .cta { min-height: 56px; padding: 0 22px; display: inline-flex; align-items: center; border-radius: var(--r-pill); font-weight: 700; text-decoration: none; color: var(--c-birch-50); border: 2px solid var(--c-birch-50); }
  .cta.primary { background: var(--c-maple-700); border-color: var(--c-maple-700); }
  .fine { margin: 14px 0 0; color: var(--c-gold-300); font-weight: 700; }
  .band { padding: 56px 20px; max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .alt { background: var(--surface); max-width: none; padding-left: 20px; padding-right: 20px; }
  .alt > * { max-width: 1040px; width: 100%; margin-left: auto; margin-right: auto; }
  h2 { margin: 0; }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 28px; }
  .steps li { display: flex; flex-direction: column; gap: 10px; }
  .art { height: 230px; display: grid; place-items: center; }
  .art.meter { align-content: center; }
  .steps h3 { margin: 0; display: flex; align-items: center; gap: 10px; }
  .n { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--lit); color: var(--c-ink-900); }
  .steps p, .band p { margin: 0; }
  .states { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
  .states li { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .two { display: grid; gap: 24px; grid-template-columns: minmax(0, 1fr); }
  .band > *, .two > * { min-width: 0; }
  .checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .checks li { display: flex; gap: 10px; align-items: flex-start; }
  .audit { background: var(--c-dusk-900); color: var(--c-birch-100); border-radius: var(--r-lg); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
  .label { font-weight: 700; color: var(--c-gold-300); }
  pre { margin: 0; max-width: 100%; white-space: pre-wrap; word-break: break-word; padding: 14px; border-radius: var(--r-md); background: var(--c-dusk-800); color: var(--c-birch-100); overflow-x: auto; font-size: 0.95rem; }
  .foot { display: flex; gap: 12px; align-items: center; padding: 28px 20px 40px; max-width: 1080px; margin: 0 auto; border-top: 1px solid var(--line); }
  .foot p { margin: 0; }
  h3 { margin: 8px 0 0; }
  .keep { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
  .keep li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px; }
  .keep h4 { margin: 0 0 6px; font-size: 1.05rem; }
  .keep dl { margin: 0; display: grid; gap: 2px; }
  .keep dt { font-weight: 700; font-size: 0.9rem; color: var(--text-muted); margin-top: 6px; }
  .keep dd { margin: 0; }
  .limits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .limits li { display: flex; gap: 10px; align-items: flex-start; }
  .plain { margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 8px; }
  .stack { display: flex; flex-direction: column; gap: 12px; }
  .stack p { margin: 0; }
  @media (min-width: 900px) {
    .nav nav { display: flex; }
    .hero { min-height: 680px; align-items: center; }
    .hero-copy { margin-left: 48px; padding: 40px; border-radius: var(--r-xl); background: rgba(22, 35, 58, 0.78); }
    .steps { grid-template-columns: repeat(3, 1fr); }
    .states { grid-template-columns: repeat(4, 1fr); }
    .two { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
    .keep { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
