<!-- "At the spot" (brief items 7 and 8): a sideways rail in place of the old 10-card grid.
     The compass card plays the real ElevenLabs clips on a tap only (never on load) while the
     Compass arrow turns. Remember this gets a card if it ships; Sounds of the spot was measured and cut (lab 10). -->
<script lang="ts">
  import Compass from "#lib/components/Compass.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t } from "#lib/copy/site.ts";
  import { onDestroy } from "svelte";

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

  @media (min-width: 1100px) {
    .rail { margin: 0; }
    .rail ul { padding: 4px 2px 16px; }
  }
</style>
