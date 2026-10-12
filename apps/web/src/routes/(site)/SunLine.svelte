<!-- Hero line with the real sunset near the visitor (brief item 5). Time zone -> city -> sunset,
     all on this page. Location only after a tap, computed here, never sent. The line keeps its
     height before it fills, so nothing moves on the first screen (CLS). -->
<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "#lib/copy/site.ts";
  import { clock, placeFor, sunFor, type Sun } from "./sunline.ts";

  let line = $state("");
  let note = $state("");
  let canLocate = $state(true);
  let asking = $state(false);

  const say = (s: Sun, city: string | null) => {
    if (city === null) {
      if (s.kind === "soon") return t("site.sun.hereSoon", { min: s.min });
      if (s.kind === "later") return t("site.sun.hereLater", { time: clock(s.at) });
      return t("site.sun.hereDown", { time: clock(s.next) });
    }
    if (s.kind === "soon") return t("site.sun.soon", { city, min: s.min });
    if (s.kind === "later") return t("site.sun.later", { city, time: clock(s.at) });
    return t("site.sun.down", { city, time: clock(s.next) });
  };

  onMount(() => {
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      zone = "";
    }
    // The 11 KB zone table loads after first paint, in its own chunk.
    import("./zones.ts").then(({ ZONES }) => {
      if (line) return; // the visitor already used their location
      const p = placeFor(zone, ZONES);
      const s = p && sunFor(p, new Date());
      if (p && s) line = say(s, p.city);
    });
  });

  function locate() {
    if (!("geolocation" in navigator)) {
      note = t("site.sun.locFail");
      return;
    }
    asking = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        asking = false;
        const s = sunFor({ lat: pos.coords.latitude, lon: pos.coords.longitude }, new Date());
        if (s) line = say(s, null);
        note = t("site.sun.locNote");
        canLocate = false;
      },
      () => {
        asking = false;
        note = t("site.sun.locFail");
      },
      { maximumAge: 600_000, timeout: 10_000, enableHighAccuracy: false },
    );
  }
</script>

<div class="sun">
  <p class="sun-line" aria-live="polite">{line}</p>
  {#if canLocate}
    <button type="button" class="pill ghost locate" onclick={locate} disabled={asking}>{t("site.sun.locate")}</button>
  {/if}
  {#if note}<p class="sun-note">{note}</p>{/if}
</div>

<style>
  .sun { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 14px; }
  .sun-line { margin: 0; font-weight: 700; color: var(--c-birch-50); min-height: 2.8em; }
  .sun-note { margin: 0; font-size: 0.95rem; color: var(--c-birch-100); }
  @media (min-width: 900px) { .sun-line { min-height: 1.4em; } }
  .sun .pill.locate { min-height: 44px; border-color: var(--c-gold-300); color: var(--c-gold-300); }
</style>
