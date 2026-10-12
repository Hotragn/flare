<!-- "Why it matters", right after the hero. One chart system: the title is the takeaway, lines
     carry their labels at the ends (no legend), one accent (the flare) for the main series and
     grey for context, at most 3 light gridlines, the latest point marked with its value. Every
     figure is read from its primary source; exact figures, years and links are in
     docs/research/why-it-matters-sources.md. Charts are aria-hidden: each has a visually hidden
     data table. Motion: lines draw and the eight Flares fill once in view (motion.ts play); still
     and complete under reduced motion. SVG text is 16 viewBox units, at least 13 px at 375 px. -->
<script lang="ts">
  import { FLAME, HOLE, ring } from "#lib/brand.ts";
  import { t } from "#lib/copy/site.ts";
  import { play } from "./motion.ts";

  const flameD = `${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`;
  // BLS ATUS 2025 (USDL-26-1022): share who socialized or communicated on an average day, and the
  // average minutes a day across everyone.
  const social = { y0: 2015, y1: 2025, share: [38, 30], min: [41, 35] };
  // Kannan and Veazie 2023 (ATUS 2003-2020): minutes a day with friends, and alone.
  const years = [2003, 2019, 2020];
  const friends = [60, 34, 20];
  const alone = [285, 309, 333];
  const X = (yr: number) => 40 + ((yr - 2003) / 17) * 185;
  const Y = (v: number) => 200 - (v / 350) * 175;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${X(years[i] as number).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  // A slope panel: 160 x 170, values on 0..max.
  const SY = (v: number, max: number) => 140 - (v / max) * 105;
</script>

{#snippet slope(vals: number[], max: number, fmt: (n: number) => string, hot: boolean)}
  <svg viewBox="0 0 160 172" class="chart" class:hot class:ctxc={!hot} aria-hidden="true">
    <line class="grid" x1="12" x2="148" y1="140" y2="140" />
    <path class="ln draw" d="M30 {SY(vals[0] as number, max)} L130 {SY(vals[1] as number, max)}" pathLength="1" />
    <circle class="pt" cx="30" cy={SY(vals[0] as number, max)} r="4" />
    <circle class="pt end" cx="130" cy={SY(vals[1] as number, max)} r="5.5" />
    <text x="30" y={SY(vals[0] as number, max) - 12} text-anchor="middle">{fmt(vals[0] as number)}</text>
    <text class="last" x="130" y={SY(vals[1] as number, max) - 12} text-anchor="middle">{fmt(vals[1] as number)}</text>
    <text class="axis" x="30" y="164" text-anchor="middle">{social.y0}</text>
    <text class="axis" x="130" y="164" text-anchor="middle">{social.y1}</text>
  </svg>
{/snippet}

<h2 class="t-title">{t("site.why.title")}</h2>
<p class="lead">{t("site.why.lead")}</p>

<div class="why" use:play>
  <figure class="fig">
    <h3>{t("site.why.social.t")}</h3>
    <div class="pair">
      <div>
        <p class="lbl hot-lbl">{t("site.why.social.share")}</p>
        {@render slope(social.share, 40, (n) => t("site.why.pct", { n }), true)}
      </div>
      <div>
        <p class="lbl">{t("site.why.social.min")}</p>
        {@render slope(social.min, 45, (n) => t("site.why.min", { n }), false)}
      </div>
    </div>
    <table class="sr-only">
      <caption>{t("site.why.social.cap")}</caption>
      <thead><tr><th scope="col">{t("site.why.col.year")}</th><th scope="col">{t("site.why.social.share")}</th><th scope="col">{t("site.why.social.min")}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{social.y0}</th><td>{t("site.why.pct", { n: social.share[0] as number })}</td><td>{t("site.why.min", { n: social.min[0] as number })}</td></tr>
        <tr><th scope="row">{social.y1}</th><td>{t("site.why.pct", { n: social.share[1] as number })}</td><td>{t("site.why.min", { n: social.min[1] as number })}</td></tr>
      </tbody>
    </table>
    <figcaption>
      <p class="src"><a href="https://www.bls.gov/news.release/archives/atus_06252026.htm" rel="noopener noreferrer">{t("site.why.social.src")}</a></p>
      <p class="src">{t("site.why.social.note")}</p>
    </figcaption>
  </figure>

  <figure class="fig">
    <h3>{t("site.why.friends.t")}</h3>
    <p class="lbl kicker">{t("site.why.friends.kicker")}</p>
    <svg viewBox="0 0 360 232" class="chart" aria-hidden="true">
      {#each [100, 200, 300] as g}<line class="grid light" x1="40" x2="225" y1={Y(g)} y2={Y(g)} />{/each}
      <line class="grid" x1="40" x2="225" y1={Y(0)} y2={Y(0)} />
      <path class="ln ctx draw" d={path(alone)} pathLength="1" />
      <path class="ln draw" d={path(friends)} pathLength="1" />
      <circle class="pt ctx" cx={X(2020)} cy={Y(333)} r="4" />
      <circle class="pt end" cx={X(2020)} cy={Y(20)} r="5.5" />
      <text class="ctx-t" x="34" y={Y(285) + 5} text-anchor="end">285</text>
      <text class="acc-t" x="34" y={Y(60) + 5} text-anchor="end">60</text>
      <text class="ctx-t" x="233" y={Y(333) + 5}>{t("site.why.alone.line", { n: 333 })}</text>
      <text class="last" x="233" y={Y(20) + 5}>{t("site.why.friends.line", { n: 20 })}</text>
      <line class="lead-line" x1={X(2020) - 3} y1={Y(100) + 6} x2={X(2020) - 1} y2={Y(20) - 9} />
      <text class="note" x={X(2020) - 6} y={Y(100)} text-anchor="end">{t("site.why.pandemic")}</text>
      <text class="axis" x="40" y="226" text-anchor="middle">2003</text>
      <text class="axis" x={X(2020)} y="226" text-anchor="middle">2020</text>
    </svg>
    <table class="sr-only">
      <caption>{t("site.why.friends.cap")}</caption>
      <thead><tr><th scope="col">{t("site.why.col.year")}</th><th scope="col">{t("site.why.col.friends")}</th><th scope="col">{t("site.why.col.alone")}</th></tr></thead>
      <tbody>
        {#each years as y, i}<tr><th scope="row">{y}</th><td>{friends[i]}</td><td>{alone[i]}</td></tr>{/each}
      </tbody>
    </table>
    <figcaption>
      <p class="src"><a href="https://doi.org/10.1016/j.ssmph.2022.101331" rel="noopener noreferrer">{t("site.why.atus.src")}</a></p>
    </figcaption>
  </figure>

  <figure class="fig">
    <h3>{t("site.why.indoor.t")}</h3>
    <div class="daybar" aria-hidden="true">
      <span class="seg bld" style:flex-basis="87%"></span><span class="seg car" style:flex-basis="6%"></span><span class="seg rest" style:flex-basis="7%"></span>
    </div>
    <div class="keys" aria-hidden="true">
      <span class="lbl k bld">{t("site.why.indoor.bld")}</span><span class="lbl k car">{t("site.why.indoor.car")}</span><span class="lbl k rest">{t("site.why.indoor.rest")}</span>
    </div>
    <table class="sr-only">
      <caption>{t("site.why.indoor.cap")}</caption>
      <thead><tr><th scope="col">{t("site.why.col.place")}</th><th scope="col">{t("site.why.col.share")}</th></tr></thead>
      <tbody>
        <tr><td>{t("site.why.indoor.bld")}</td><td>87%</td></tr>
        <tr><td>{t("site.why.indoor.car")}</td><td>6%</td></tr>
        <tr><td>{t("site.why.indoor.rest")}</td><td>7%</td></tr>
      </tbody>
    </table>
    <figcaption>
      <p class="src"><a href="https://doi.org/10.1038/sj.jea.7500165" rel="noopener noreferrer">{t("site.why.indoor.src")}</a></p>
    </figcaption>
  </figure>

  <figure class="fig">
    <h3>{t("site.why.lonely.t")}</h3>
    <div class="people" role="img" aria-label={t("site.why.lonely.aria")}>
      {#each [0, 1, 2, 3, 4, 5] as i}<span class="who" class:hot={i === 5} style:--i={i}></span>{/each}
    </div>
    <figcaption>
      <p>{t("site.why.lonely.deaths")}</p>
      <p class="src"><a href="https://www.who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death" rel="noopener noreferrer">{t("site.why.lonely.src")}</a></p>
    </figcaption>
  </figure>

  <figure class="fig wide act">
    <h3>{t("site.why.nature.t")}</h3>
    <div class="flares" role="img" aria-label={t("site.why.nature.aria")}>
      {#each Array.from({ length: 8 }, (_, i) => i) as i}
        <span class="fl" style:--i={i}>
          <svg viewBox="0 0 100 100" aria-hidden="true"><path class="fo" fill-rule="evenodd" d={flameD} /><path class="ff" fill-rule="evenodd" d={flameD} /></svg>
          <span class="lbl">15</span>
        </span>
      {/each}
    </div>
    <p class="flares-line">{t("site.why.flares")}</p>
    <figcaption>
      <p>{t("site.why.nature.b")}</p>
      <p class="src"><a href="https://doi.org/10.1038/s41598-019-44097-3" rel="noopener noreferrer">{t("site.why.nature.src")}</a></p>
      <p class="end">{t("site.why.end")}</p>
    </figcaption>
  </figure>
</div>

<style>
  .why { --acc: var(--accent-text); --ctx: var(--text-muted); display: grid; gap: 16px; }
  .fig { margin: 0; padding: 18px; border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; color: var(--text); }
  .fig h3 { margin: 0; font-size: 1.2rem; line-height: 1.3; }
  figcaption { display: flex; flex-direction: column; gap: 6px; }
  figcaption p { margin: 0; }
  .src { font-size: 0.875rem; color: var(--text-muted); }
  .src a { color: var(--text-muted); }
  .lbl { margin: 0; font-size: 0.875rem; font-weight: 700; color: var(--ctx); }
  .hot-lbl, .kicker { color: var(--acc); }
  .end { font-weight: 800; font-size: 1.15rem; color: var(--acc); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  .chart { display: block; width: 100%; max-width: 400px; height: auto; overflow: visible; }
  .chart text { font-size: 16px; font-weight: 700; fill: var(--ctx); }
  .chart .last { fill: var(--acc); font-weight: 800; }
  .chart .axis { font-weight: 600; }
  .chart .note { font-style: italic; font-weight: 600; fill: var(--text); }
  .chart.hot text:not(.axis), .chart .acc-t { fill: var(--acc); }
  .ctxc .last { fill: var(--ctx); }
  .grid { stroke: var(--text-muted); stroke-width: 1; opacity: 0.55; }
  .grid.light { opacity: 0.22; }
  .ln { fill: none; stroke: var(--acc); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
  .ctxc .ln, .ln.ctx { stroke: var(--ctx); stroke-width: 3; }
  .pt { fill: var(--acc); }
  .ctxc .pt, .pt.ctx { fill: var(--ctx); }
  .lead-line { stroke: var(--text); stroke-width: 1.5; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .daybar { display: flex; height: 34px; border-radius: 10px; overflow: hidden; transform-origin: 0 50%; }
  .seg.bld { background: var(--acc); }
  .seg.car { background: var(--ctx); }
  .seg.rest { background: var(--line); }
  .keys { display: flex; flex-wrap: wrap; gap: 4px 16px; }
  .k::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; background: var(--line); }
  .k.bld { color: var(--acc); }
  .k.bld::before { background: var(--acc); }
  .k.car::before { background: var(--ctx); }

  .people { display: flex; gap: 10px; align-items: end; height: 76px; }
  .who { position: relative; width: 34px; height: 70px; }
  .who::before { content: ""; position: absolute; left: 8px; top: 0; width: 18px; height: 18px; border-radius: 50%; background: var(--ctx); opacity: 0.55; }
  .who::after { content: ""; position: absolute; left: 1px; bottom: 0; width: 32px; height: 46px; border-radius: 16px 16px 6px 6px; background: var(--ctx); opacity: 0.55; }
  .who.hot::before, .who.hot::after { background: var(--acc); opacity: 1; }

  .flares { display: grid; grid-template-columns: repeat(8, minmax(0, 52px)); gap: 6px; }
  .fl { display: grid; justify-items: center; gap: 2px; }
  .fl svg { width: 100%; max-width: 44px; aspect-ratio: 1; overflow: visible; }
  .fo { fill: none; stroke: var(--ctx); stroke-width: 4; opacity: 0.6; }
  .ff { fill: var(--acc); transform-origin: 50px 96px; }
  .flares-line { margin: 0; font-weight: 800; font-size: 1.1rem; }

  /* Motion, once in view: lines draw, the bar fills, people appear, and the eight Flares light one
     by one like a count. Not armed (no JS, reduced motion): the finished charts. */
  :global(.armed) .draw { stroke-dasharray: 1; stroke-dashoffset: 1; }
  :global(.armed.play) .draw { animation: draw 1100ms var(--ease-out) 200ms both; }
  :global(.armed) :is(.pt, .last, .note, .lead-line) { opacity: 0; }
  :global(.armed.play) :is(.pt, .last, .note, .lead-line) { animation: fade 300ms linear 1200ms both; }
  :global(.armed) .daybar { transform: scaleX(0); }
  :global(.armed.play) .daybar { animation: grow-x 900ms var(--ease-out) 150ms both; }
  :global(.armed) .ff { opacity: 0; transform: scale(0.4); }
  :global(.armed.play) .ff { animation: light 420ms var(--ease-spring) calc(400ms + var(--i) * 220ms) both; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes fade { to { opacity: 1; } }
  @keyframes grow-x { from { transform: scaleX(0); } to { transform: none; } }
  @keyframes light { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }

  @media (min-width: 900px) {
    .why { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .wide { grid-column: 1 / -1; }
  }
</style>
