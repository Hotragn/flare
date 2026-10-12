<!-- "At the spot" (brief items 7 and 8): a sideways rail in place of the old 10-card grid.
     The compass card plays the real ElevenLabs clips on a tap only (never on load) while the
     Compass arrow turns; Remember this and Sounds of the spot are not live yet and say so.
     Remember this shows its consent rule: every person's check comes before the mic. -->
<script lang="ts">
  import Compass from "#lib/components/Compass.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t } from "#lib/copy/site.ts";
  import { onDestroy } from "svelte";
  import { play } from "./motion.ts";

  // The same clips the app plays (static/voice, ADR-0027): "150 meters, slightly left." then
  // "Straight ahead." The arrow turns with them: -32 deg, then 0.
  const CLIPS = ["/voice/m-150.mp3", "/voice/dir-slightLeft.mp3", "/voice/ahead.mp3"];
  let bearing = $state(-32);
  let playing = $state(false);
  let audio: HTMLAudioElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    playing = false;
    clearTimeout(timer);
    audio?.pause();
    audio = null;
  }
  function hear() {
    if (playing) return stop();
    playing = true;
    let i = 0;
    const next = () => {
      if (!playing) return;
      if (i >= CLIPS.length) return stop();
      if (i === 2) bearing = 0; // facing: the arrow lines up and the flame lights
      audio = new Audio(CLIPS[i++]);
      audio.onended = () => (timer = setTimeout(next, i === 2 ? 700 : 120));
      audio.onerror = stop;
      audio.play().catch(stop);
    };
    bearing = -18;
    next();
  }
  onDestroy(stop);

  function near(img: HTMLImageElement) {
    const go = () => {
      img.src = img.dataset.src ?? "";
    };
    if (typeof IntersectionObserver === "undefined") return go();
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        go();
        io.disconnect();
      },
      { rootMargin: "300px" },
    );
    io.observe(img);
    return { destroy: () => io.disconnect() };
  }
</script>

<h2 class="t-title">{t("site.spot.title")}</h2>
<p class="lead">{t("site.spot.lead")}</p>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard scroll, axe scrollable-region-focusable) -->
<div class="rail" role="region" aria-label={t("site.spot.rail")} tabindex="0">
  <ul>
    <li class="card compass">
      <div class="cmp"><Compass name="Amor" meters={150} {bearing} status="pointing" /></div>
      <h3>{t("site.feat.compass.t")}</h3>
      <p>{t("site.feat.compass.b")}</p>
      <button type="button" class="pill" aria-pressed={playing} onclick={hear}>
        <Icon name={playing ? "mute" : "sound"} />{playing ? t("site.spot.stop") : t("site.spot.hear")}
      </button>
      <p class="small">{t("site.spot.voice")}</p>
    </li>
    <li class="card">
      <img use:near data-src="/site/feat/loop.webp" width="120" height="180" decoding="async" alt={t("site.feat.alt", { title: t("site.feat.loop.t") })} />
      <h3>{t("site.feat.loop.t")}</h3>
      <p>{t("site.feat.loop.b")}</p>
    </li>
    <li class="card">
      <img use:near data-src="/site/feat/spark.webp" width="120" height="180" decoding="async" alt={t("site.feat.alt", { title: t("site.feat.spark.t") })} />
      <h3>{t("site.feat.spark.t")}</h3>
      <p>{t("site.feat.spark.b")}</p>
    </li>
    <li class="card">
      <div class="consent" use:play role="img" aria-label={t("site.spot.rem.aria")}>
        {#each [0, 1, 2] as i}
          <span class="who" style:--i={i}><span class="tick"></span></span>
        {/each}
        <span class="mic"><Icon name="mic" size={30} /></span>
      </div>
      <span class="soon">{t("site.spot.soon")}</span>
      <h3>{t("site.spot.rem.t")}</h3>
      <p>{t("site.spot.rem.b")}</p>
    </li>
    <li class="card">
      <div class="waves" use:play aria-hidden="true">
        {#each [0.4, 0.75, 1, 0.6, 0.85, 0.5, 0.7, 0.35, 0.65] as h, i}<span style:--h={h} style:--i={i}></span>{/each}
      </div>
      <span class="soon">{t("site.spot.soon")}</span>
      <h3>{t("site.spot.snd.t")}</h3>
      <p>{t("site.spot.snd.b")}</p>
    </li>
  </ul>
</div>

<style>
  .rail { margin: 0 -20px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding: 0 20px; outline-offset: -3px; scrollbar-width: thin; }
  .rail ul { list-style: none; margin: 0; padding: 4px 20px 16px; display: flex; gap: 14px; width: max-content; }
  .card { scroll-snap-align: start; width: 272px; padding: 16px; border-radius: 22px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start;
    background: linear-gradient(160deg, #f3ead9, #e5efe3); box-shadow: 0 6px 18px rgb(22 35 58 / 0.08); color: #1d2b1f; }
  .card h3 { margin: 0; font-size: 1.15rem; font-weight: 800; }
  .card p { margin: 0; color: #33402f; }
  .card .small { font-size: 0.9rem; }
  .card img { width: 120px; height: 180px; object-fit: cover; border-radius: 14px; background: #1b1512; align-self: center; }

  .compass { width: 300px; }
  .cmp { align-self: center; color: #1d2b1f; }
  .cmp :global(.dial) { width: 170px; height: 170px; }
  .cmp :global(.dist) { font-size: 1.6rem; }
  .cmp :global(.spoken) { font-size: 0.95rem; min-height: 2.6em; }

  .soon { padding: 3px 10px; border-radius: 999px; background: #1d2b1f; color: #FBF8F2; font-size: 0.85rem; font-weight: 800; }
  .consent { align-self: center; height: 180px; display: grid; grid-template-columns: repeat(3, 56px); grid-template-rows: 64px 1fr; justify-items: center; align-items: center; gap: 6px 10px; }
  .who { position: relative; width: 52px; height: 52px; border-radius: 50%; background: #c7b597; }
  .who::before { content: ""; position: absolute; left: 50%; top: 9px; width: 18px; height: 18px; margin-left: -9px; border-radius: 50%; background: #6B4E2E; }
  .who::after { content: ""; position: absolute; left: 50%; bottom: 6px; width: 30px; height: 14px; margin-left: -15px; border-radius: 15px 15px 4px 4px; background: #6B4E2E; }
  .tick { position: absolute; right: -6px; bottom: -6px; z-index: 1; width: 24px; height: 24px; border-radius: 50%; background: #2F6B52; border: 2px solid #FBF8F2; }
  .tick::after { content: ""; position: absolute; left: 7px; top: 3px; width: 5px; height: 10px; border: solid #FBF8F2; border-width: 0 2.5px 2.5px 0; rotate: 45deg; }
  .mic { grid-column: 1 / -1; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--c-maple-700); color: #FBF8F2; }
  .waves { align-self: center; height: 180px; display: flex; align-items: center; gap: 7px; }
  .waves span { width: 12px; height: 110px; border-radius: 6px; background: #2F6B52; transform: scaleY(var(--h)); }

  /* Motion: the checks land one by one, then the mic appears; the sound bars rise. Once. */
  :global(.armed).consent .tick { opacity: 0; transform: scale(0.3); }
  :global(.armed).consent .mic { opacity: 0; transform: scale(0.6); }
  :global(.armed.play).consent .tick { animation: pop 380ms var(--ease-spring) calc(300ms + var(--i) * 450ms) both; }
  :global(.armed.play).consent .mic { animation: pop 420ms var(--ease-spring) 1800ms both; }
  :global(.armed).waves span { transform: scaleY(0.08); }
  :global(.armed.play).waves span { animation: rise 900ms var(--ease-out) calc(200ms + var(--i) * 60ms) both; }
  @keyframes pop { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: none; } }
  @keyframes rise { 0% { transform: scaleY(0.08); } 60% { transform: scaleY(calc(var(--h) * 1.15)); } 100% { transform: scaleY(var(--h)); } }

  @media (min-width: 1100px) {
    .rail { margin: 0; }
    .rail ul { padding: 4px 2px 16px; }
  }
</style>
