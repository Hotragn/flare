<!--
  The Flare website (W1 to W6), one scroll. Mobile first, two columns from 900 px.
  Copy follows the writing rules; every claim points to a number or a file.
-->
<script lang="ts">
  import Scenery from "#lib/components/Scenery.svelte";
  import Flame from "#lib/components/Flame.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import PhotoPrint from "#lib/components/PhotoPrint.svelte";
  import FlameMeter from "#lib/components/FlameMeter.svelte";
</script>

<svelte:head>
  <title>Flare, for getting friends outside</title>
  <meta name="description" content="Snap where you are. If enough friends quietly say yes, it's on. Open source, private, works with no signal." />
  <meta property="og:image" content="/brand/og-image-1200x630.png" />
</svelte:head>

<div class="site" data-theme="light">
  <header class="nav">
    <a href="#top" class="brand" aria-label="Flare home"><img src="/brand/flare-lockup-horizontal-light.svg" alt="Flare" width="120" height="44" /></a>
    <nav aria-label="Sections">
      <a href="#how">How it works</a><a href="#privacy">Privacy</a><a href="#access">Accessibility</a><a href="#run">Run it</a>
    </nav>
  </header>

  <main>
  <!-- W1 Hero -->
  <section id="top" class="hero">
    <div class="hero-art" aria-hidden="true"><Scenery width={1200} height={640} /></div>
    <div class="hero-copy">
      <p class="kicker">Flare, for getting friends outside</p>
      <h1 class="t-display">If enough friends say yes, it's on.</h1>
      <p class="lead">Snap where you are. Friends get a short invite and answer in private. It only happens if enough say yes, and nobody ever sees a no.</p>
      <div class="ctas">
        <a class="cta primary" href="/proto/">Try the prototype</a>
        <a class="cta" href="#how">See how</a>
      </div>
      <p class="fine">Seconds of screen. An hour outside.</p>
    </div>
  </section>

  <!-- W2 How it works -->
  <section id="how" class="band">
    <h2 class="t-title">How it works</h2>
    <ol class="steps">
      <li>
        <div class="art"><PhotoPrint scene="A pond with yellow trees and an empty bench." height={200} tilt={-2} /></div>
        <h3 class="t-heading"><span class="n">1</span> Snap where you are</h3>
        <p>The photo develops like a print while an open model writes six words. Send it to iMessage, WhatsApp or Telegram.</p>
      </li>
      <li>
        <div class="art meter"><FlameMeter have={2} quorum={3} /></div>
        <h3 class="t-heading"><span class="n">2</span> Friends say yes, in private</h3>
        <p>Each yes grows the flame. Everyone sees the count, never the names. Add a condition like "only if Amor comes".</p>
      </li>
      <li>
        <div class="art"><Flame state="lit" size={150} /></div>
        <h3 class="t-heading"><span class="n">3</span> It's lit. Go.</h3>
        <p>When enough say yes, everyone gets the spot. A talking compass finds your friend, even with no signal.</p>
      </li>
    </ol>
  </section>

  <!-- W3 Shrink -->
  <section class="band alt">
    <h2 class="t-title">It shrinks instead of dying</h2>
    <p class="lead">Plans fail in group chats. Flare plans get smaller.</p>
    <ul class="states">
      <li><Flame state="kindling" progress={0.5} size={96} /><b>Kindling</b><span>Waiting for yeses, up to 30 min.</span></li>
      <li><Flame state="lit" size={96} /><b>Lit</b><span>Enough said yes. Go.</span></li>
      <li><Flame state="ember" size={96} /><b>Ember</b><span>Didn't catch? 15 min at the nearest bench. One friend is enough.</span></li>
      <li><Flame state="gone" size={96} /><b>Gone</b><span>"Not this time." Same words for everyone. Then it's deleted.</span></li>
    </ul>
    <p>Plans for later have four sizes, from a long loop to 20 minutes on a bench. Anyone who's tired can quietly make it one step smaller.</p>
  </section>

  <!-- W4 Privacy -->
  <section id="privacy" class="band">
    <h2 class="t-title">The privacy promise</h2>
    <div class="two">
      <ul class="checks">
        <li><Icon name="here" /><span>Photos are encrypted on your phone. The key is in the link, after the #, and never reaches our server.</span></li>
        <li><Icon name="here" /><span>Conditions and access needs stay on your phone. Only rules like "back by 5 PM" are sent.</span></li>
        <li><Icon name="here" /><span>Nobody's no is ever shown or stored.</span></li>
        <li><Icon name="here" /><span>Within 5 minutes of the end, the Flare, its photo and every yes are deleted. A few counts remain.</span></li>
        <li><Icon name="here" /><span>No accounts, no ads, no trackers.</span></li>
      </ul>
      <div class="audit">
        <p class="label">Deletion audit, after our Sunday field test</p>
        <pre><code>Audit output appears here after the field test (Sun Oct 11).
It counts leftover records in every store; passing is 0.</code></pre>
        <p class="t-small">Limits we're honest about: Telegram sees what's posted in Telegram. In a small group, people can sometimes guess who said yes. Text and satellite messages are outside our control.</p>
      </div>
    </div>
  </section>

  <!-- W5 Accessibility -->
  <section id="access" class="band alt">
    <h2 class="t-title">Built for friends who need more</h2>
    <div class="two">
      <ul class="checks">
        <li><Icon name="bench" /><span>Every invite shows benches, restrooms and mapped steps near the spot.</span></li>
        <li><Icon name="steps" /><span>Set your needs once, on your phone. If a spot doesn't suit you, Flare counts you in for a closer one, and nobody learns why.</span></li>
        <li><Icon name="compass" /><span>The talking compass says "Fuego, 400 meters, slightly left." No map to read.</span></li>
        <li><Icon name="info" /><span>The invite photo has a spoken description for screen readers.</span></li>
        <li><Icon name="card" /><span>Bench to Bench prints a large-print walking card with a seat every 200 m.</span></li>
      </ul>
      <div>
        <p>Target: WCAG 2.2 AA on every screen, body text at 7:1 contrast or more, touch targets 44 pt. Tested with VoiceOver and the largest text size. Known gaps are listed on GitHub.</p>
        <p class="t-small">Why benches: they raise the chance a mobility-impaired senior goes for a walk from 60% to 75% (Netspar). 12.2% of US adults have a mobility disability and 5.5% a vision disability (CDC, 2022).</p>
      </div>
    </div>
  </section>

  <!-- W6 Run it yourself -->
  <section id="run" class="band">
    <h2 class="t-title">Run it yourself</h2>
    <p>Flare is open source. The AI is open-weight Gemma 4 running on your own laptop, so your photos never touch a closed API.</p>
    <pre><code>git clone https://github.com/Hotragn/flare-outside
cd flare-outside
ollama pull gemma4:e4b
npm ci && npm run dev</code></pre>
    <p class="t-small">The repository link goes live when the repo is public. Full setup steps are in the README.</p>
  </section>

  </main>

  <footer class="foot">
    <img src="/brand/flare-mark-maple.svg" alt="" width="36" height="36" />
    <p>Made for the DEV Hacktoberfest Open-Source AI Challenge, Week 1: Touch Grass. Map data © OpenStreetMap contributors.</p>
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
  @media (min-width: 900px) {
    .nav nav { display: flex; }
    .hero { min-height: 680px; align-items: center; }
    .hero-copy { margin-left: 48px; padding: 40px; border-radius: var(--r-xl); background: rgba(22, 35, 58, 0.78); }
    .steps { grid-template-columns: repeat(3, 1fr); }
    .states { grid-template-columns: repeat(4, 1fr); }
    .two { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
  }
</style>
