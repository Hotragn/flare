<!-- Home scroll story (brief item 1, replaces the static Steps and Shrink sections): one Flare at
     the pond bench, Kindling -> Lit -> Ember -> Gone. The sky turns to golden hour, the phone shows
     the Flare, three friends walk in and the count goes 1, 2, 3 until it lights; another day it
     shrinks to an Ember on the bench; then the scene empties and leaves fall.
     Every moving part animates transform or opacity only, from one set of keyframes over the
     story's progress (motion.ts explains the three ways they are driven). The four chapter lines
     are real text in reading order; the stage is one image to a screen reader. -->
<script lang="ts">
  import Scenery from "#lib/components/Scenery.svelte";
  import { FLAME, HOLE, DOME, ring } from "#lib/brand.ts";
  import { t, type CopyKey } from "#lib/copy/site.ts";
  import { story } from "./motion.ts";

  const flameD = `${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`;
  const emberD = `${DOME} ${ring(50, 81, 8)}`;
  const chapters: [string, CopyKey, CopyKey][] = [
    ["k", "flame.kindling", "site.story.k"],
    ["l", "flame.lit", "site.story.l"],
    ["e", "flame.ember", "site.story.e"],
    ["g", "flame.gone", "site.story.g"],
  ];
  // Count ring: three segments, like CountRing.svelte.
  const R = 44;
  const C = 2 * Math.PI * R;
  const seg = C / 3 - 8;
  const LEAF = "M10 1 L12 6 L16 4 L15 9 L19 10 L15 12 L16 15 L11 13 L10.6 19 L9.4 19 L9 13 L4 15 L5 12 L1 10 L5 9 L4 4 L8 6 Z";
  const leaves = [
    [12, "#E2622A"],
    [30, "#F2B33D"],
    [47, "#9E2C17"],
    [63, "#E2622A"],
    [80, "#F2B33D"],
    [92, "#9E2C17"],
  ] as const;
</script>

<div class="story-head">
  <h2 class="t-title">{t("site.story.title")}</h2>
  <p class="lead">{t("site.story.lead")}</p>
</div>

<div class="story" use:story>
  <div class="stage-wrap">
    <div class="stage" role="img" aria-label={t("site.story.scene")}>
      <div class="bg"><Scenery width={800} height={600} people={false} /></div>
      <div class="a day"></div>
      <div class="a dusk"></div>
      <svg class="fg" viewBox="0 0 800 600" aria-hidden="true">
        <ellipse cx="300" cy="512" rx="130" ry="22" fill="#4E7F96" />
        <ellipse cx="290" cy="506" rx="70" ry="6" fill="#8DB6C4" opacity="0.7" />
        <g fill="#211A16">
          <rect x="432" y="465" width="64" height="5" rx="2" /><rect x="432" y="477" width="64" height="5" rx="2" />
          <rect x="436" y="477" width="4" height="12" /><rect x="488" y="477" width="4" height="12" />
          <circle cx="450" cy="441" r="7" /><rect x="442" y="453" width="16" height="24" rx="7" />
        </g>
      </svg>
      <!-- Three friends, each in a small box of its own (cheap layers on phones). -->
      {#each [1, 2, 3] as i}
        <div class="a friend f{i}" aria-hidden="true">
          <svg viewBox="0 0 20 48"><circle cx="10" cy="7" r="7" /><rect x="2" y="16" width="16" height="32" rx="7" /></svg>
        </div>
      {/each}
      <div class="bench-flame" aria-hidden="true">
        <span class="a glow"></span>
        <svg class="a bf kin" viewBox="0 0 100 100"><path fill-rule="evenodd" d={flameD} /></svg>
        <svg class="a bf lit" viewBox="0 0 100 100"><path fill-rule="evenodd" d={flameD} /><circle cx={HOLE.cx} cy={HOLE.cy} r="6" /></svg>
        <svg class="a bf emb" viewBox="0 0 100 100"><path fill-rule="evenodd" d={emberD} /></svg>
        <svg class="a bf gone" viewBox="0 0 100 100"><path d="M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22" /></svg>
      </div>
      {#each leaves as [x, c], i}
        <svg class="a leaf l{i}" style:left="{x}%" viewBox="0 0 20 20" aria-hidden="true"><path d={LEAF} fill={c} /></svg>
      {/each}

      <div class="a phone" aria-hidden="true">
        <div class="screen">
          <div class="ringbox">
            <svg viewBox="0 0 100 100" class="ring">
              {#each [0, 1, 2] as i}
                <circle cx="50" cy="50" r={R} class="seg" stroke-dasharray="{seg} {C - seg}" stroke-dashoffset={-(i * (C / 3)) + C / 4} />
                <circle cx="50" cy="50" r={R} class="a seg on s{i}" stroke-dasharray="{seg} {C - seg}" stroke-dashoffset={-(i * (C / 3)) + C / 4} />
              {/each}
            </svg>
            <svg class="a pf kin" viewBox="0 0 100 100"><path fill-rule="evenodd" d={flameD} /></svg>
            <svg class="a pf lit" viewBox="0 0 100 100"><path fill-rule="evenodd" d={flameD} /><circle cx={HOLE.cx} cy={HOLE.cy} r="6" /></svg>
            <svg class="a pf emb" viewBox="0 0 100 100"><path fill-rule="evenodd" d={emberD} /></svg>
            <svg class="a pf gone" viewBox="0 0 100 100"><path d="M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22" /></svg>
          </div>
          <p class="words">
            <span class="a w c0">{t("need.toLight", { n: 3 })}</span>
            <span class="a w c1">{t("site.story.count", { n: 1 })}</span>
            <span class="a w c2">{t("site.story.count", { n: 2 })}</span>
            <span class="a w c3">{t("need.lit")}</span>
            <span class="a w c4">{t("site.story.ember")}</span>
            <span class="a w c5">{t("site.story.deleted")}</span>
          </p>
        </div>
      </div>

      <ol class="dots" aria-hidden="true">
        {#each chapters as [id]}<li class="dot d-{id}"></li>{/each}
      </ol>
    </div>
  </div>

  <div class="chapters">
    {#each chapters as [id, name, line], i}
      <article class="chapter ch-{id}" data-i={i}>
        <h3 class="t-heading"><span class="n" aria-hidden="true">{i + 1}</span> {t(name)}</h3>
        <p>{t(line)}</p>
      </article>
    {/each}
  </div>
</div>

<style>
  .story-head { display: flex; flex-direction: column; gap: 8px; }
  .story-head .lead { margin: 0; }
  .story { position: relative; display: grid; gap: 0; view-timeline: --story block; --p: 0.375; }

  /* ---------- layout: phone first. The scene pins under the nav, the lines scroll under it. ---------- */
  .stage-wrap { position: sticky; top: 108px; z-index: 2; background: var(--bg); padding: 8px 0; margin: 0 -20px; }
  .stage { position: relative; aspect-ratio: 4 / 3; overflow: hidden; contain: layout paint; background: var(--c-dusk-900); }
  .chapters { display: flex; flex-direction: column; }
  .chapter { min-height: 58vh; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 24px 0; }
  .chapter h3 { margin: 0; display: flex; align-items: center; gap: 10px; }
  .chapter p { margin: 0; max-width: 36ch; font-size: 1.15rem; }
  .chapter .n { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--c-gold-400); color: var(--c-ink-900); flex: none; }
  .story:global([data-ch="0"]) .ch-k .n, .story:global([data-ch="1"]) .ch-l .n, .story:global([data-ch="2"]) .ch-e .n, .story:global([data-ch="3"]) .ch-g .n { background: var(--c-maple-700); color: var(--c-birch-50); }

  @media (min-width: 900px) {
    .story { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 48px; }
    .stage-wrap { top: calc(50vh - min(21vw, 260px) + 30px); align-self: start; margin: 0; padding: 0; background: none; }
    .stage { border-radius: 28px; box-shadow: var(--e-3); }
    .chapter { min-height: 78vh; }
    .chapter p { font-size: 1.25rem; }
  }

  /* ---------- the stage layers ---------- */
  .bg, .day, .dusk { position: absolute; inset: 0; }
  .bg :global(svg) { width: 100%; height: 100%; display: block; }
  .day { bottom: 38%; background: linear-gradient(#7FB2D9, #BFDDEB 80%, #E6E1C8); }
  .dusk { background: #16233A; opacity: 0; }
  .fg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .friend { position: absolute; width: 2.5%; top: 72%; }
  .friend svg { display: block; width: 100%; fill: #211A16; }
  .f1 { left: 58.5%; }
  .f2 { left: 66.5%; }
  .f3 { left: 70%; top: 71%; }
  .bench-flame { position: absolute; left: 61.6%; top: 67.5%; width: 4.4%; aspect-ratio: 1; }
  .bf, .glow { position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: 50% 96%; }
  .glow { inset: -160%; width: auto; height: auto; border-radius: 50%; background: radial-gradient(closest-side, rgb(247 203 114 / 0.75), rgb(247 203 114 / 0)); transform-origin: 50% 50%; }
  .bf.kin, .pf.kin { fill: var(--c-gold-400); }
  .bf.lit, .pf.lit { fill: #E2622A; }
  .bf.lit circle, .pf.lit circle { fill: var(--c-gold-400); }
  .bf.emb, .pf.emb { fill: #B8441C; }
  .bf.gone, .pf.gone { fill: none; stroke: #9A938A; stroke-width: 5; stroke-linecap: round; }
  .leaf { position: absolute; top: -6%; width: 2.6%; }

  .phone { position: absolute; left: 3%; top: 6%; width: 30%; aspect-ratio: 9 / 16; container-type: inline-size; transform-origin: 50% 100%; }
  @media (min-width: 900px) { .phone { width: 24%; } }
  .screen { position: absolute; inset: 0; border-radius: 14cqw; border: 4cqw solid #111; background: linear-gradient(#22324D, #2E4A6B 55%, #3A4F6D);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6cqw; box-shadow: 0 10px 30px rgb(0 0 0 / 0.4); }
  .ringbox { position: relative; width: 62cqw; aspect-ratio: 1; }
  .ring { position: absolute; inset: 0; transform: rotate(-90deg); }
  .seg { fill: none; stroke: rgb(255 255 255 / 0.22); stroke-width: 7; stroke-linecap: round; }
  .seg.on { stroke: var(--c-gold-400); }
  .pf { position: absolute; inset: 20%; width: 60%; height: 60%; transform-origin: 50% 96%; }
  .words { position: relative; margin: 0; width: 88%; height: 2.6em; font-size: 9.5cqw; line-height: 1.25; font-weight: 700; color: #FBF8F2; text-align: center; }
  .w { position: absolute; inset: 0; opacity: 0; }

  .dots { position: absolute; left: 50%; bottom: 4%; translate: -50% 0; display: flex; gap: 8px; margin: 0; padding: 6px 10px; list-style: none;
    border-radius: 999px; background: rgb(22 35 58 / 0.6); }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: rgb(251 248 242 / 0.45); transition: background var(--dur-base) var(--ease-out), scale var(--dur-base) var(--ease-out); }
  .story:global(:not([data-ch])) .d-l, .story:global([data-ch="0"]) .d-k, .story:global([data-ch="1"]) .d-l, .story:global([data-ch="2"]) .d-e, .story:global([data-ch="3"]) .d-g { background: var(--c-gold-300); scale: 1.35; }

  /* ---------- driving the frames (motion.ts) ----------
     Default and fallback: each animation is 1 s long, paused, and shifted back by --p seconds, so
     it shows the frame for progress p. Native: the story's view timeline drives the same frames. */
  .a { animation-duration: 1s; animation-timing-function: linear; animation-fill-mode: both; animation-play-state: paused; animation-delay: calc(var(--p) * -1s); }
  .story:global([data-mode="native"]) .a { animation-play-state: running; animation-delay: 0s; animation-duration: auto; animation-timeline: --story; animation-range: contain 0% contain 100%; }
  .story:global([data-mode="still"]) .dot { transition: none; }

  .day { animation-name: day; }
  .dusk { animation-name: dusk; }
  .f1 { animation-name: f1; }
  .f2 { animation-name: f2; }
  .f3 { animation-name: f3; }
  .glow { animation-name: glow; }
  .kin { animation-name: kin; }
  .lit { animation-name: lit; }
  .emb { animation-name: emb; }
  .gone { animation-name: gone; }
  .phone { animation-name: phone; }
  .s0 { animation-name: s0; }
  .s1 { animation-name: s1; }
  .s2 { animation-name: s2; }
  .c0 { animation-name: c0; }
  .c1 { animation-name: c1; }
  .c2 { animation-name: c2; }
  .c3 { animation-name: c3; }
  .c4 { animation-name: c4; }
  .c5 { animation-name: c5; }
  .leaf { animation-name: fall; }
  .l1 { animation-name: fall1; }
  .l2 { animation-name: fall2; }
  .l3 { animation-name: fall1; }
  .l4 { animation-name: fall2; }
  .l5 { animation-name: fall; }

  /* Kindling 0-25 %: the sky turns golden, the phone shows the Flare, friends arrive one by one. */
  @keyframes day { 0% { opacity: 1; } 11%, 100% { opacity: 0; } }
  @keyframes phone { 0%, 2% { opacity: 0; transform: translateY(8%) scale(0.85); } 7%, 100% { opacity: 1; transform: none; } }
  @keyframes f1 { 0%, 8% { transform: translateX(-2600%); } 14%, 77% { transform: none; } 86%, 100% { transform: translateX(1800%); } }
  @keyframes f2 { 0%, 13% { transform: translateX(-2900%); } 19%, 52% { transform: none; } 60%, 100% { transform: translateX(1500%); } }
  @keyframes f3 { 0%, 18% { transform: translateX(-3000%); } 24%, 53% { transform: none; } 61%, 100% { transform: translateX(1400%); } }
  @keyframes s0 { 0%, 13% { opacity: 0; } 14%, 56% { opacity: 1; } 58%, 100% { opacity: 0.35; } }
  @keyframes s1 { 0%, 18% { opacity: 0; } 19%, 54% { opacity: 1; } 58%, 100% { opacity: 0; } }
  @keyframes s2 { 0%, 23% { opacity: 0; } 24%, 54% { opacity: 1; } 58%, 100% { opacity: 0; } }
  /* The flame: Kindling grows a notch per yes; Lit catches at 3; Ember is the small dome; Gone is smoke. */
  @keyframes kin {
    0%, 3% { opacity: 0; transform: scale(0.55); }
    7% { opacity: 1; transform: scale(0.55); }
    13% { transform: scale(0.55); } 14% { transform: scale(0.67); }
    18% { transform: scale(0.67); } 19% { transform: scale(0.78); }
    23% { opacity: 1; transform: scale(0.78); } 24% { opacity: 1; transform: scale(0.9); }
    26%, 100% { opacity: 0; transform: scale(0.95); }
  }
  @keyframes lit {
    0%, 24% { opacity: 0; transform: scale(0.9); }
    27% { opacity: 1; transform: scale(1.08); }
    30% { transform: scale(1); }
    54% { opacity: 1; transform: scale(1); }
    60%, 100% { opacity: 0; transform: scale(0.5); }
  }
  @keyframes glow { 0%, 24% { opacity: 0; transform: scale(0.6); } 28% { opacity: 1; transform: scale(1.1); } 34%, 54% { opacity: 0.85; transform: scale(1); } 60%, 77% { opacity: 0.35; transform: scale(0.6); } 84%, 100% { opacity: 0; transform: scale(0.4); } }
  @keyframes emb { 0%, 56% { opacity: 0; transform: scaleY(1.6); } 61% { opacity: 1; transform: scaleY(1); } 79% { opacity: 1; transform: none; } 84%, 100% { opacity: 0; transform: scale(0.6); } }
  @keyframes gone { 0%, 81% { opacity: 0; transform: translate(-6%, 8%); } 86%, 93% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translate(4%, -10%); } }
  /* Gone 78-100 %: dusk, the bench empties, leaves fall. */
  @keyframes dusk { 0%, 76% { opacity: 0; } 92%, 100% { opacity: 0.5; } }
  @keyframes fall { 0%, 78% { opacity: 0; transform: translateY(0) rotate(0); } 80% { opacity: 1; } 100% { opacity: 1; transform: translateY(2900%) rotate(260deg); } }
  @keyframes fall1 { 0%, 81% { opacity: 0; transform: translateY(0) rotate(0); } 83% { opacity: 1; } 100% { opacity: 1; transform: translateY(2500%) translateX(120%) rotate(-200deg); } }
  @keyframes fall2 { 0%, 84% { opacity: 0; transform: translateY(0) rotate(0); } 86% { opacity: 1; } 100% { opacity: 1; transform: translateY(1900%) translateX(-90%) rotate(160deg); } }
  /* The phone's words, one at a time. */
  @keyframes c0 { 0%, 13% { opacity: 1; } 13.5%, 100% { opacity: 0; } }
  @keyframes c1 { 0%, 13.5% { opacity: 0; } 14%, 18.5% { opacity: 1; } 19%, 100% { opacity: 0; } }
  @keyframes c2 { 0%, 18.5% { opacity: 0; } 19%, 23.5% { opacity: 1; } 24%, 100% { opacity: 0; } }
  @keyframes c3 { 0%, 24% { opacity: 0; } 25%, 55% { opacity: 1; } 57%, 100% { opacity: 0; } }
  @keyframes c4 { 0%, 57% { opacity: 0; } 59%, 79% { opacity: 1; } 81%, 100% { opacity: 0; } }
  @keyframes c5 { 0%, 81% { opacity: 0; } 83%, 100% { opacity: 1; } }

  /* Reduced motion: motion.ts steps --p to each chapter's middle; nothing moves in between. */
  @media (prefers-reduced-motion: reduce) {
    .dot { transition: none; }
  }
</style>
