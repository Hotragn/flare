<!-- "Start in a minute" (brief item 2): three steps, each with a small phone screen that plays
     once when it comes into view (motion.ts play). Then the real Telegram card, which a tap turns
     from Waiting to It's lit (brief item 7). Screens are pictures (aria-hidden); the step text
     says the same thing. -->
<script lang="ts">
  import { FLAME, HOLE, ring } from "#lib/brand.ts";
  import { t } from "#lib/copy/site.ts";
  import { ORIGIN } from "./seo.ts";
  import { play } from "./motion.ts";

  const host = `${new URL(ORIGIN).host}/app`;
  const flameD = `${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`;
  let lit = $state(false);
</script>

<h2 class="t-title">{t("site.start.title")}</h2>
<p class="lead">{t("site.start.lead")}</p>

<ol class="start" use:play>
  <li>
    <div class="mini" aria-hidden="true">
      <div class="bar"><span class="url">{host}</span><span class="wipe"></span></div>
      <div class="open">
        <img src="/brand/flare-mark-maple.svg" alt="" width="44" height="44" loading="lazy" />
        <b>{t("app.name")}</b>
      </div>
    </div>
    <h3 class="t-heading"><span class="n" aria-hidden="true">1</span> {t("site.start.s1.t")}</h3>
    <p>{t("site.start.s1.b")}</p>
  </li>
  <li>
    <div class="mini" aria-hidden="true">
      <div class="field">
        <span class="label">{t("join.nameLabel")}</span>
        <span class="box"><span class="typed">{t("site.start.sampleName")}</span><span class="wipe"></span><span class="caret"></span></span>
      </div>
      <span class="ok"></span>
    </div>
    <h3 class="t-heading"><span class="n" aria-hidden="true">2</span> {t("site.start.s2.t")}</h3>
    <p>{t("site.start.s2.b")}</p>
  </li>
  <li>
    <div class="mini" aria-hidden="true">
      <svg class="mflame" viewBox="0 0 100 100"><path fill-rule="evenodd" d={flameD} /></svg>
      <span class="send">{t("site.start.send")}</span>
      <span class="chips"><span>Telegram</span><span>iMessage</span></span>
      <span class="tap"></span>
    </div>
    <h3 class="t-heading"><span class="n" aria-hidden="true">3</span> {t("site.start.s3.t")}</h3>
    <p>{t("site.start.s3.b")}</p>
  </li>
</ol>

<div class="tg">
  <div class="tg-copy">
    <h3 class="t-heading">{t("site.tg.title")}</h3>
    <p>{t("site.tg.note")}</p>
    <button type="button" class="pill" aria-pressed={lit} onclick={() => (lit = !lit)}>{lit ? t("site.tg.back") : t("site.tg.flip")}</button>
  </div>
  <div class="card" class:lit>
    <div class="face front" aria-hidden={lit}>
      <img src="/site/tg/waiting.webp" width="480" height="320" loading="lazy" decoding="async" alt={t("site.tg.waitingAlt")} />
    </div>
    <div class="face back" aria-hidden={!lit}>
      <img src="/site/tg/lit.webp" width="480" height="320" loading="lazy" decoding="async" alt={t("site.tg.litAlt")} />
    </div>
  </div>
</div>

<style>
  .start { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 28px; }
  .start li { display: grid; grid-template-columns: 120px 1fr; grid-template-rows: auto 1fr; column-gap: 16px; row-gap: 6px; align-items: start; }
  .start .mini { grid-row: span 2; }
  .start h3 { margin: 0; display: flex; align-items: center; gap: 10px; }
  .start p { margin: 0; max-width: 34ch; }

  /* A small phone, drawn in CSS: 120 x 210. */
  .mini { position: relative; width: 120px; height: 210px; border-radius: 22px; border: 5px solid #111; background: linear-gradient(#22324D, #2E4A6B);
    overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #FBF8F2; box-shadow: var(--e-2); }
  .wipe { position: absolute; inset: 0; background: inherit; transform-origin: 100% 50%; transform: scaleX(0); }
  .bar { position: absolute; top: 10px; left: 6px; right: 6px; min-height: 26px; border-radius: 9px; background: #FBF8F2; color: #211A16; font-size: 8px; line-height: 1.2; font-weight: 700;
    display: flex; align-items: center; padding: 3px 7px; overflow: hidden; overflow-wrap: anywhere; }
  .bar .wipe { background: #FBF8F2; }
  .open { display: grid; justify-items: center; gap: 4px; font-size: 18px; }
  .field { display: grid; gap: 6px; width: 92px; }
  .label { font-size: 10px; font-weight: 700; color: var(--c-gold-300); }
  .box { position: relative; height: 30px; border-radius: 8px; background: #FBF8F2; color: #211A16; font-weight: 700; font-size: 14px; display: flex; align-items: center; padding: 0 8px; overflow: hidden; }
  .box .wipe { background: #FBF8F2; }
  .caret { width: 2px; height: 16px; background: #A93C12; margin-left: 1px; opacity: 0; }
  .ok { width: 28px; height: 28px; border-radius: 50%; background: #2F6B52; position: relative; }
  .ok::after { content: ""; position: absolute; left: 10px; top: 5px; width: 7px; height: 13px; border: solid #FBF8F2; border-width: 0 3px 3px 0; rotate: 45deg; }
  .mflame { width: 54px; height: 54px; fill: #E2622A; transform-origin: 50% 96%; }
  .send { padding: 6px 14px; border-radius: 999px; background: #A93C12; font-size: 12px; font-weight: 800; }
  .chips { display: flex; gap: 4px; font-size: 9px; font-weight: 700; }
  .chips span { padding: 4px 6px; border-radius: 6px; background: rgb(251 248 242 / 0.16); }
  .tap { position: absolute; left: 50%; top: 58%; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; background: rgb(251 248 242 / 0.5); opacity: 0; }

  /* Motion: armed means hidden at frame 0; play runs it once. Not armed (no JS, reduced motion): the finished screen. */
  :global(.armed) .wipe { transform: scaleX(1); }
  :global(.armed) :is(.open, .ok, .send, .chips) { opacity: 0; }
  :global(.armed) .mflame { transform: scale(0.55); }
  :global(.armed.play) .bar .wipe { animation: unwipe 900ms steps(14, end) 300ms forwards; }
  :global(.armed.play) .open { animation: rise 420ms var(--ease-out) 1300ms both; }
  :global(.armed.play) .box .wipe { animation: unwipe 600ms steps(4, end) 900ms forwards; }
  :global(.armed.play) .caret { animation: blink 500ms steps(1) 900ms 4; }
  :global(.armed.play) .ok { animation: pop 380ms var(--ease-spring) 1700ms both; }
  :global(.armed.play) .mflame { animation: grow 900ms var(--ease-spring) 1500ms both; }
  :global(.armed.play) .send { animation: rise 360ms var(--ease-out) 2000ms both; }
  :global(.armed.play) .tap { animation: tap 600ms var(--ease-out) 2500ms both; }
  :global(.armed.play) .chips { animation: rise 360ms var(--ease-out) 3000ms both; }
  @keyframes unwipe { to { transform: scaleX(0); } }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }
  @keyframes grow { 0% { transform: scale(0.55); } 33% { transform: scale(0.67); } 66% { transform: scale(0.78); } 100% { transform: scale(1); } }
  @keyframes tap { 0% { opacity: 0; transform: scale(0.4); } 40% { opacity: 1; } 100% { opacity: 0; transform: scale(1.6); } }

  /* The Telegram card: a 3D flip on tap; a crossfade with reduced motion. */
  .tg { margin-top: 20px; display: grid; gap: 16px; align-items: center; padding: 18px; border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); }
  .tg-copy { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .tg-copy h3, .tg-copy p { margin: 0; }
  .card { position: relative; width: 100%; max-width: 480px; aspect-ratio: 3 / 2; perspective: 1200px; }
  .face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 16px; overflow: hidden; box-shadow: var(--e-2);
    transition: transform 700ms var(--ease-spring); }
  .face img { display: block; width: 100%; height: 100%; }
  .back { transform: rotateY(180deg); }
  .lit .front { transform: rotateY(-180deg); }
  .lit .back { transform: rotateY(0deg); }
  @media (prefers-reduced-motion: reduce) {
    .face { backface-visibility: visible; transition: opacity 160ms linear; transform: none !important; }
    .back { opacity: 0; }
    .lit .back { opacity: 1; }
    .lit .front { opacity: 0; }
  }
  @media (min-width: 900px) {
    .start { grid-template-columns: repeat(3, 1fr); gap: 32px; }
    .start li { grid-template-columns: 1fr; justify-items: start; }
    .start .mini { grid-row: auto; width: 140px; height: 250px; margin-bottom: 10px; }
    .tg { grid-template-columns: 1fr minmax(0, 480px); padding: 28px; }
  }
</style>
