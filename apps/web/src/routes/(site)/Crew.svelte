<!-- "Your crew space" (brief item 2), with a sample crew labelled as one: places, time outside
     this week, Sparks, the Crew Atlas and Manage crew. Motion: the week's bars fill and the
     Atlas pins drop, once, when the card comes into view. Still and complete without it. -->
<script lang="ts">
  import { t, type CopyKey } from "#lib/copy/site.ts";
  import Icon from "#lib/components/Icon.svelte";
  import { play } from "./motion.ts";

  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  // Sample places on a 320 x 200 Atlas (x, y), with how often the crew met there.
  const places: { key: CopyKey; n: number; last: string; x: number; y: number }[] = [
    { key: "site.crew.p1", n: 5, last: "2026-10-09", x: 128, y: 92 },
    { key: "site.crew.p2", n: 3, last: "2026-10-04", x: 214, y: 58 },
    { key: "site.crew.p3", n: 2, last: "2026-09-27", x: 62, y: 146 },
    { key: "site.crew.p4", n: 1, last: "2026-09-20", x: 262, y: 150 },
  ];
  // Minutes outside together, Monday to Sunday: 160 min in all (2 h 40 min).
  const week = [0, 35, 0, 45, 20, 60, 0];
  const most = Math.max(...week);
</script>

<h2 class="t-title">{t("site.crew.title")}</h2>
<p class="lead">{t("site.crew.lead")}</p>

<div class="crew" use:play>
  <div class="head">
    <h3>{t("site.crew.name")}</h3>
    <span class="badge">{t("site.crew.sample")}</span>
  </div>

  <div class="grid">
    <div class="panel">
      <p class="week-line">{t("crew.week", { h: 2, m: 40 })}</p>
      <div class="bars" aria-hidden="true">
        {#each week as m, i}
          <span class="bar" style:--h={m / most} style:--i={i}></span>
        {/each}
      </div>
    </div>

    <figure class="panel atlas">
      <svg viewBox="0 0 320 200" role="img" aria-label={t("atlas.aria", { n: places.length })}>
        <rect width="320" height="200" rx="14" fill="#E9E2CF" />
        <path d="M0 170 C60 150 90 190 150 176 S250 130 320 140 L320 200 L0 200 Z" fill="#CFE0C3" />
        <path d="M200 0 C220 30 190 60 230 90 S300 120 320 110 L320 0 Z" fill="#B9D3A9" />
        <path d="M-10 120 C60 110 110 130 170 118 S270 80 330 96" fill="none" stroke="#8DB6C4" stroke-width="7" />
        <ellipse cx="128" cy="104" rx="34" ry="13" fill="#8DB6C4" />
        <path d="M30 40 L120 90 L214 58 L262 150 M120 90 L62 146" fill="none" stroke="#B49F7A" stroke-width="2.5" stroke-dasharray="5 5" />
        {#each places as p, i}
          <g class="pin" style:--i={i} transform="translate({p.x} {p.y})">
            <g class="drop">
              <path d="M0 0 C-9 -12 -13 -18 -13 -25 A13 13 0 1 1 13 -25 C13 -18 9 -12 0 0 Z" fill="#A93C12" />
              <text y="-21" text-anchor="middle" font-size="13" font-weight="800" fill="#FBF8F2">{p.n}</text>
            </g>
          </g>
        {/each}
      </svg>
      <figcaption>{t("site.crew.atlasNote")}</figcaption>
    </figure>

    <div class="panel">
      <h4>{t("crew.places")}</h4>
      <ul class="places">
        {#each places as p}
          <li><b>{t(p.key)}</b><span>{p.n === 1 ? t("atlas.factOne", { date: day(p.last) }) : t("atlas.fact", { n: p.n, date: day(p.last) })}</span></li>
        {/each}
      </ul>
    </div>

    <div class="panel">
      <h4>{t("site.crew.sparks")}</h4>
      <ul class="sparks">
        <li>{t("site.crew.spark1")}</li>
        <li>{t("site.crew.spark2")}</li>
      </ul>
      <div class="manage">
        <Icon name="edit" />
        <div>
          <h4>{t("crew.manage")}</h4>
          <p>{t("site.crew.manageB")}</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .lead { margin: 0; }
  .crew { border-radius: var(--r-xl); padding: 18px; background: linear-gradient(160deg, #f3ead9, #e5efe3); box-shadow: 0 6px 18px rgb(22 35 58 / 0.08); color: #1d2b1f; }
  .head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .head h3 { margin: 0; font-size: 1.4rem; }
  .badge { padding: 4px 12px; border-radius: 999px; border: 2px dashed #6B4E2E; color: #4A3520; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .grid { display: grid; gap: 14px; }
  .panel { margin: 0; padding: 14px; border-radius: 18px; background: rgb(251 248 242 / 0.85); display: flex; flex-direction: column; gap: 8px; }
  .panel h4 { margin: 0; font-size: 1.05rem; }
  .week-line { margin: 0; font-weight: 700; }
  .bars { display: grid; grid-template-columns: repeat(7, 1fr); align-items: end; gap: 6px; height: 64px; }
  .bar { display: block; height: 100%; border-radius: 6px 6px 3px 3px; background: #2F6B52; transform-origin: 50% 100%; transform: scaleY(max(0.06, var(--h))); }
  .atlas svg { width: 100%; height: auto; display: block; }
  .atlas figcaption { font-size: 0.95rem; color: #33402f; }
  .places, .sparks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .places li { display: flex; flex-direction: column; }
  .places span { color: #33402f; font-size: 0.95rem; }
  .sparks li { padding: 10px 12px; border-radius: 12px; background: #fff; border-left: 4px solid var(--c-gold-400); font-family: var(--font-display, serif); font-size: 1.05rem; }
  .manage { display: flex; gap: 10px; align-items: flex-start; margin-top: 6px; padding-top: 10px; border-top: 1px solid rgb(29 43 31 / 0.15); }
  .manage p { margin: 2px 0 0; color: #33402f; }

  /* Motion: bars fill from the floor, pins drop in one after another (play in motion.ts). */
  :global(.armed) .bar { transform: scaleY(0); }
  :global(.armed.play) .bar { animation: fill 700ms var(--ease-out) calc(200ms + var(--i) * 70ms) both; }
  :global(.armed) .drop { opacity: 0; }
  :global(.armed.play) .drop { animation: drop 520ms var(--ease-spring) calc(500ms + var(--i) * 160ms) both; }
  @keyframes fill { from { transform: scaleY(0); } to { transform: scaleY(max(0.06, var(--h))); } }
  @keyframes drop { from { opacity: 0; transform: translateY(-40px); } 60% { opacity: 1; } to { opacity: 1; transform: none; } }

  @media (min-width: 900px) {
    .crew { padding: 28px; }
    .grid { grid-template-columns: 1fr 1.3fr; }
    .atlas { grid-row: span 2; grid-column: 2; }
  }
</style>
