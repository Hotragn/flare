<!-- Crew Atlas (ADR-0029): the crew's places on one small map, drawn on this phone. Positions
     come from the map pack already on the phone (place keys are OSM ids), context from its water,
     woods and parks; no map tiles, no request, so the places never leave the phone. Facts only
     from the sealed Hot spots blob: how often you met there and the last day.
     Motion: the path between your places draws in (oldest to newest), the pins drop in one by one,
     and the last place you met pulses softly while the map is on screen. Reduced motion: still. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "#lib/copy/index.ts";
  import { ambient } from "#lib/motion/ambient.ts";
  import type { MapPack } from "@flare/shared/icd/map";
  type Spot = { place_key: string; place_name: string; count: number; last_date: string };
  let { places, area = "fairlane", load }: { places: Spot[]; area?: string; load: (area: string) => Promise<MapPack> } = $props();

  const W = 320;
  const H = 200;
  type Dot = { name: string; count: number; last: string; x: number; y: number };
  let dots = $state<Dot[]>([]);
  let context = $state<{ x: number; y: number; k: string }[]>([]);
  onMount(async () => {
    const pack = await load(area).catch(() => null);
    if (!pack) return;
    const at = new Map(pack.items.map((it) => [it[3], [it[1], it[2]] as [number, number]]));
    const known = places.flatMap((p) => {
      const ll = at.get(p.place_key);
      return ll ? [{ p, lat: ll[0], lon: ll[1] }] : [];
    });
    if (!known.length) return;
    // A box around the places, at least 600 m across, so one place still sits in a map.
    const lats = known.map((k) => k.lat);
    const lons = known.map((k) => k.lon);
    const pad = 0.003;
    let [s, n] = [Math.min(...lats) - pad, Math.max(...lats) + pad];
    let [w, e] = [Math.min(...lons) - pad * 1.4, Math.max(...lons) + pad * 1.4];
    const cosLat = Math.cos(((s + n) / 2) * (Math.PI / 180));
    // Keep the map's aspect: widen whichever side is short.
    const spanX = (e - w) * cosLat;
    const spanY = n - s;
    if (spanX / spanY < W / H) {
      const need = ((spanY * W) / H / cosLat - (e - w)) / 2;
      w -= need;
      e += need;
    } else {
      const need = ((spanX * H) / W - spanY) / 2;
      s -= need;
      n += need;
    }
    const px = (lat: number, lon: number) => ({ x: ((lon - w) / (e - w)) * W, y: ((n - lat) / (n - s)) * H });
    dots = known.map(({ p, lat, lon }) => ({ name: p.place_name, count: p.count, last: p.last_date, ...px(lat, lon) }));
    context = pack.items
      .filter((it) => "wfkrb".includes(it[0]) && it[1] > s && it[1] < n && it[2] > w && it[2] < e)
      .slice(0, 1200)
      .map((it) => ({ ...px(it[1], it[2]), k: it[0] }));
  });
  const r = (count: number) => 6 + 3 * Math.log2(count);
  // Oldest to newest: the path you walked as a crew, and the newest place gets the pulse.
  const order = $derived([...dots].sort((a, b) => a.last.localeCompare(b.last)));
  const trail = $derived(order.map((d, i) => `${i ? "L" : "M"}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(" "));
  const newest = $derived(order[order.length - 1]);
  const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
</script>

{#if dots.length}
  <section class="atlas" aria-labelledby="atlas-t">
    <h2 class="t-heading" id="atlas-t">{t("atlas.title")}</h2>
    <svg viewBox="0 0 {W} {H}" role="img" aria-label={t("atlas.aria", { n: dots.length })} use:ambient>
      <rect width={W} height={H} rx="18" class="land" />
      {#each context as c}<circle cx={c.x} cy={c.y} r={c.k === "w" ? 2.4 : c.k === "r" ? 1.1 : 1.6} class={c.k === "w" ? "water" : c.k === "r" ? "street" : c.k === "b" ? "bench" : "green"} />{/each}
      {#if order.length > 1}<path d={trail} class="trail" pathLength="1" />{/if}
      {#each order as d, i}
        <g class="pin" style:animation-delay="{300 + i * 90}ms">
          {#if d === newest}<circle cx={d.x} cy={d.y} r={r(d.count) + 5} class="pulse" />{/if}
          <circle cx={d.x} cy={d.y} r={r(d.count) + 5} class="glow" />
          <circle cx={d.x} cy={d.y} r={r(d.count)} class="spot" />
          <text x={d.x} y={d.y - r(d.count) - 6} text-anchor="middle">{d.name.length > 22 ? `${d.name.slice(0, 21)}…` : d.name}</text>
        </g>
      {/each}
    </svg>
    <ul class="facts">
      {#each dots as d}<li><b>{d.name}</b><span>{d.count === 1 ? t("atlas.factOne", { date: day(d.last) }) : t("atlas.fact", { n: d.count, date: day(d.last) })}</span></li>{/each}
    </ul>
    <p class="t-small t-muted">{t("atlas.note")}</p>
  </section>
{/if}

<style>
  .atlas { display: flex; flex-direction: column; gap: 8px; }
  .atlas h2, .atlas p { margin: 0; }
  svg { width: 100%; height: auto; display: block; }
  .land { fill: #dfe9d3; }
  .water { fill: #8fb7d6; opacity: 0.7; }
  .green { fill: #9cbf86; opacity: 0.6; }
  .street { fill: #8a8f84; opacity: 0.45; }
  .bench { fill: #6b5a3e; opacity: 0.5; }
  .glow { fill: var(--c-gold-400, #f2b544); opacity: 0.35; }
  .spot { fill: var(--c-maple-700, #b8410f); stroke: #fff; stroke-width: 2; }
  text { font: 700 11px system-ui, sans-serif; fill: #1d2b1f; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
  .trail { fill: none; stroke: var(--c-maple-700, #b8410f); stroke-width: 2.5; stroke-dasharray: 1; stroke-linecap: round; opacity: 0.7; animation: draw 900ms var(--ease-in-out) both; }
  @keyframes draw { from { stroke-dashoffset: 1; opacity: 0; } 10% { opacity: 0.7; } to { stroke-dashoffset: 0; } }
  .pin { animation: drop 420ms var(--ease-spring) both; }
  @keyframes drop { from { transform: translateY(-18px); opacity: 0; } to { transform: none; opacity: 1; } }
  .pulse { fill: none; stroke: var(--c-gold-400, #f2b544); stroke-width: 3; transform-box: fill-box; transform-origin: center; animation: pulse 2.4s ease-out 1.2s infinite; opacity: 0; }
  @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
  .atlas :global(svg[data-paused] *) { animation-play-state: paused; }
  @media (prefers-reduced-motion: reduce) { .trail, .pin, .pulse { animation: none; } .trail { stroke-dashoffset: 0; } }
  :global([data-reduce-motion]) .trail, :global([data-reduce-motion]) .pin, :global([data-reduce-motion]) .pulse { animation: none; }
  .facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .facts li { display: flex; justify-content: space-between; gap: 10px; }
  .facts span { color: var(--text-muted); white-space: nowrap; }
</style>
