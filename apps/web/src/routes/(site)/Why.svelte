<!-- "Why it matters", right after the hero: real numbers on time indoors, time with friends,
     time alone and loneliness, then the action (120 min a week outside). Every figure is checked
     against its primary source; the exact figures, years and links are in
     docs/research/why-it-matters-sources.md. Charts are pictures of the sentence beside them
     (aria-hidden): the sentence carries every number for screen readers. One accent colour. Bars
     draw in once when in view (motion.ts play); without motion they are simply there. -->
<script lang="ts">
  import { t } from "#lib/copy/site.ts";
  import { play } from "./motion.ts";

  const friends = [
    [2003, 60],
    [2019, 34],
    [2020, 20],
  ] as const;
  const alone = [
    [2003, 285],
    [2019, 309],
    [2020, 333],
  ] as const;
</script>

{#snippet bars(rows: readonly (readonly [number, number])[], max: number)}
  <div class="cols" aria-hidden="true">
    {#each rows as [year, n], i}
      <div class="col" class:hot={i === rows.length - 1} style:--h={n / max} style:--i={i}>
        <span class="val">{t("site.why.min", { n })}</span>
        <span class="bar"></span>
        <span class="yr">{year}</span>
      </div>
    {/each}
  </div>
{/snippet}

<h2 class="t-title">{t("site.why.title")}</h2>
<p class="lead">{t("site.why.lead")}</p>

<div class="why" use:play>
  <figure class="fig wide">
    <h3>{t("site.why.indoor.t")}</h3>
    <div class="daybar" aria-hidden="true">
      <span class="seg bld" style:flex-basis="87%"></span><span class="seg car" style:flex-basis="6%"></span><span class="seg rest" style:flex-basis="7%"></span>
    </div>
    <div class="keys" aria-hidden="true">
      <span class="k bld">{t("site.why.indoor.bld")}</span><span class="k car">{t("site.why.indoor.car")}</span><span class="k rest">{t("site.why.indoor.rest")}</span>
    </div>
    <figcaption>
      <p>{t("site.why.indoor.b")}</p>
      <p class="src"><a href="https://doi.org/10.1038/sj.jea.7500165" rel="noopener noreferrer">{t("site.why.indoor.src")}</a></p>
    </figcaption>
  </figure>

  <figure class="fig">
    <h3>{t("site.why.friends.t")}</h3>
    {@render bars(friends, 60)}
    <figcaption>
      <p>{t("site.why.friends.b")}</p>
      <p class="src"><a href="https://doi.org/10.1016/j.ssmph.2022.101331" rel="noopener noreferrer">{t("site.why.atus.src")}</a></p>
    </figcaption>
  </figure>

  <figure class="fig">
    <h3>{t("site.why.alone.t")}</h3>
    {@render bars(alone, 333)}
    <figcaption>
      <p>{t("site.why.alone.b")}</p>
      <p class="src"><a href="https://doi.org/10.1016/j.ssmph.2022.101331" rel="noopener noreferrer">{t("site.why.atus.src")}</a></p>
    </figcaption>
  </figure>

  <figure class="fig">
    <h3>{t("site.why.lonely.t")}</h3>
    <div class="people" aria-hidden="true">
      {#each [0, 1, 2, 3] as i}<span class="who" class:hot={i === 3} style:--i={i}></span>{/each}
    </div>
    <figcaption>
      <p>{t("site.why.lonely.b")}</p>
      <p class="src"><a href="https://news.gallup.com/opinion/gallup/512618/almost-quarter-world-feels-lonely.aspx" rel="noopener noreferrer">{t("site.why.lonely.src")}</a></p>
    </figcaption>
  </figure>

  <figure class="fig wide act">
    <h3>{t("site.why.nature.t")}</h3>
    <div class="blocks" aria-hidden="true">
      {#each Array.from({ length: 8 }, (_, i) => i) as i}<span style:--i={i}>15</span>{/each}
    </div>
    <figcaption>
      <p>{t("site.why.nature.b")}</p>
      <p class="src"><a href="https://doi.org/10.1038/s41598-019-44097-3" rel="noopener noreferrer">{t("site.why.nature.src")}</a></p>
      <p class="end">{t("site.why.end")}</p>
    </figcaption>
  </figure>
</div>

<style>
  .why { display: grid; gap: 16px; }
  .fig { margin: 0; padding: 18px; border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 12px; }
  .fig h3 { margin: 0; font-size: 1.2rem; }
  figcaption { display: flex; flex-direction: column; gap: 6px; }
  figcaption p { margin: 0; }
  .src { font-size: 0.9rem; color: var(--text-muted); }
  .src a { color: var(--text-muted); }
  .end { font-weight: 800; font-size: 1.15rem; color: var(--accent-text); }

  /* Neutral ink for context, maple for the point. */
  .daybar { display: flex; height: 34px; border-radius: 10px; overflow: hidden; transform-origin: 0 50%; }
  .seg.bld { background: var(--c-maple-700); }
  .seg.car { background: #6f6259; }
  .seg.rest { background: #c9bfae; }
  .keys { display: flex; flex-wrap: wrap; gap: 4px 16px; font-weight: 700; font-size: 0.95rem; }
  .k::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; background: #c9bfae; }
  .k.bld::before { background: var(--c-maple-700); }
  .k.car::before { background: #6f6259; }

  .cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; height: 170px; align-items: end; }
  .col { display: grid; grid-template-rows: auto 1fr auto; height: 100%; justify-items: center; gap: 4px; font-weight: 700; }
  .bar { align-self: end; width: 100%; max-width: 64px; height: calc(var(--h) * 100%); background: #8f847a; border-radius: 8px 8px 3px 3px; transform-origin: 50% 100%; }
  .col.hot .bar { background: var(--c-maple-700); }
  .col.hot .val { color: var(--accent-text); }
  .val { align-self: end; font-size: 0.95rem; }
  .yr { font-size: 0.9rem; color: var(--text-muted); }

  .people { display: flex; gap: 14px; align-items: end; height: 84px; }
  .who { position: relative; width: 40px; height: 76px; }
  .who::before { content: ""; position: absolute; left: 10px; top: 0; width: 20px; height: 20px; border-radius: 50%; background: #8f847a; }
  .who::after { content: ""; position: absolute; left: 2px; bottom: 0; width: 36px; height: 50px; border-radius: 18px 18px 6px 6px; background: #8f847a; }
  .who.hot::before, .who.hot::after { background: var(--c-maple-700); }

  .blocks { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; max-width: 520px; }
  .blocks span { display: grid; place-items: center; aspect-ratio: 1; border-radius: 10px; background: #2F6B52; color: #FBF8F2; font-weight: 800; font-size: 0.9rem; }

  /* Motion, once in view: the bar fills left to right, columns rise, people and blocks pop in. */
  :global(.armed) .daybar, :global(.armed) .bar { transform: scale(0); }
  :global(.armed) :is(.who, .blocks span) { opacity: 0; }
  :global(.armed.play) .daybar { animation: grow-x 900ms var(--ease-out) 150ms both; }
  :global(.armed.play) .bar { animation: grow-y 800ms var(--ease-out) calc(300ms + var(--i) * 160ms) both; }
  :global(.armed.play) .who { animation: pop 360ms var(--ease-spring) calc(300ms + var(--i) * 140ms) both; }
  :global(.armed.play) .blocks span { animation: pop 320ms var(--ease-spring) calc(400ms + var(--i) * 110ms) both; }
  @keyframes grow-x { from { transform: scaleX(0); } to { transform: none; } }
  @keyframes grow-y { from { transform: scaleY(0); } to { transform: none; } }
  @keyframes pop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: none; } }

  @media (min-width: 900px) {
    .why { grid-template-columns: repeat(3, 1fr); }
    .wide { grid-column: 1 / -1; }
  }
</style>
