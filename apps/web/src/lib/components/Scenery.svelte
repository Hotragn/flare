<!-- The outdoor scene (same art as the DEV cover, brand/tools/covers.mjs): banded sky, sun or moon,
     hills, birches, a path to a bench, friends by a Lit fire. Decorative.
     It is the real sky: the phase of the day follows this phone's clock and the sun (#lib/motion/sky.ts),
     rain falls when rain is likely and the trees sway in wind (`sky`). It lays itself out for the box it
     fills, so nothing important is cut off on a tall phone. Fixed `width`/`height` (the website hero)
     keep the classic golden-hour drawing unless `sky` is passed. Ambient motion pauses off screen,
     and under reduced motion the scene is still: rain shows as still streaks. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { FLAME, HOLE, ring } from "../brand";
  import { ambient } from "#lib/motion/ambient.ts";
  import { skyAt, type Phase, type SkyInput } from "#lib/motion/sky.ts";
  let {
    people = true,
    width = undefined,
    height = undefined,
    sky = undefined,
  }: { people?: boolean; width?: number; height?: number; sky?: SkyInput } = $props();

  let el: SVGSVGElement;
  let box = $state({ w: 400, h: 360 });
  let now = $state(new Date());
  const fixed = $derived(width !== undefined || height !== undefined);
  const W = $derived(width ?? box.w);
  const H = $derived(height ?? box.h);
  onMount(() => {
    const tick = setInterval(() => (now = new Date()), 60_000);
    let ro: ResizeObserver | undefined;
    if (!fixed && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(([e]) => {
        const r = e?.contentRect;
        if (r && r.width > 0 && r.height > 0) box = { w: Math.round(r.width), h: Math.round(r.height) };
      });
      ro.observe(el);
    }
    return () => { clearInterval(tick); ro?.disconnect(); };
  });

  // The motion catalog fixes the hour for every scene on the page: <html data-sky-hour="21">.
  const pinned = typeof document === "undefined" ? undefined : document.documentElement.dataset.skyHour;
  const s = $derived(
    fixed && !sky ? { phase: "golden" as Phase, sun: 0.95, rain: false, windy: false } : skyAt(now, pinned ? { ...sky, hour: Number(pinned) } : sky),
  );
  // Sky colours top to horizon. Golden hour is the brand drawing; the rest blend three stops.
  const GOLD = ["#22324D", "#283A57", "#2E4A6B", "#3A4F6D", "#7C5B5E", "#B0643F", "#D6762F", "#EC9A33", "#F2B33D", "#F7CB72"];
  const STOPS: Record<Exclude<Phase, "golden">, [string, string, string]> = {
    day: ["#5E93C9", "#8DB8DD", "#D7E8EF"],
    dawn: ["#34416B", "#B07C93", "#F4C496"],
    dusk: ["#141B33", "#4B3A5E", "#B9624A"],
    night: ["#070C1C", "#0F1830", "#22304D"],
  };
  const RAINY: [string, string, string] = ["#4A5566", "#6B7683", "#9AA3AB"];
  const mix = (a: string, b: string, k: number) => {
    const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
    return `rgb(${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k)).join(" ")})`;
  };
  const bands = $derived.by(() => {
    if (s.phase === "golden" && !s.rain) return GOLD;
    const [a, b, c] = s.rain ? RAINY : STOPS[s.phase as Exclude<Phase, "golden">];
    return Array.from({ length: 10 }, (_, i) => (i < 5 ? mix(a, b, i / 5) : mix(b, c, (i - 5) / 4)));
  });
  // Night lays a blue veil over the land; rain a grey one.
  const veil = $derived(s.rain ? 0.28 : ({ night: 0.5, dusk: 0.3, dawn: 0.12, day: 0, golden: 0 } as const)[s.phase]);
  const stars = $derived(s.rain ? 0 : s.phase === "night" ? 1 : s.phase === "dusk" ? 0.55 : s.phase === "dawn" ? 0.25 : 0);

  // Layout: a tall box keeps the horizon higher so the land shows above a screen's sheet.
  const tall = $derived(W / H < 0.8);
  const hz = $derived(fixed ? 0.62 : tall ? 0.44 : 0.62);
  const u = $derived(Math.min(W, H * 1.1) / 400);
  const sunUp = $derived(!s.rain && (s.phase === "day" || s.phase === "golden" || s.phase === "dawn"));
  const arc = $derived(Math.sin(Math.PI * Math.min(1, Math.max(0, s.sun))));
  const sun = $derived({
    x: W * (fixed ? 0.56 : 0.18 + 0.64 * Math.min(1, Math.max(0, s.sun))),
    y: H * hz * (1 - 0.82 * arc),
    r: (fixed ? H * 0.115 : 44 * u) * (s.phase === "day" ? 0.8 : 1),
    c: s.phase === "day" ? "#FFF3CF" : s.phase === "dawn" ? "#F9CF9F" : "#F7CB72",
  });
  const flameD = `${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`;
  const leaves = [[0.18, 0.12, 20], [0.7, 0.18, -30], [0.86, 0.08, 60], [0.4, 0.3, -10], [0.08, 0.86, 40], [0.92, 0.9, 15]];
  const LEAF = "M10 1 L12 6 L16 4 L15 9 L19 10 L15 12 L16 15 L11 13 L10.6 19 L9.4 19 L9 13 L4 15 L5 12 L1 10 L5 9 L4 4 L8 6 Z";
  // Fixed spots for stars and rain (a seeded spread, so the sky does not jump between renders).
  const spread = (n: number, k: number) => Array.from({ length: n }, (_, i) => [((i * 0.618034 * k) % 1 + 1) % 1, ((i * 0.4142 + i * i * 0.0137) % 1 + 1) % 1]);
  const starAt = spread(26, 1.7);
  const dropAt = spread(42, 2.3);
  // Birches: inside the box on a tall phone (no half circles at the edges).
  const trees = $derived(fixed || !tall ? [[0.86, 0.5, 9, 1], [0.78, 0.36, 7, 1]] : [[0.8, 0.2, 8, 1.35], [0.16, 0.15, 7, 1.15]]);
  const leafy = $derived(s.windy); // leaves blow only in wind (still ones sat on headlines)
  const benchX = $derived(W * (tall && !fixed ? 0.36 : 0.54));
  const benchY = $derived(H * (hz + (tall && !fixed ? 0.1 : 0.155)));
</script>

<svg bind:this={el} use:ambient viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
  class="scenery {s.phase}" class:rain={s.rain} class:windy={s.windy}>
  {#each bands as c, i}<rect y={(i * H * hz) / bands.length} width={W} height={(H * hz) / bands.length + 1} fill={c} />{/each}
  {#if stars}
    <g class="stars" opacity={stars} fill="#FFF8E6">
      {#each starAt as [x, y], i}<circle cx={x * W} cy={y * H * hz * 0.7} r={(i % 3 === 0 ? 1.6 : 1) * Math.max(1, u)} style:animation-delay="{(i % 7) * 0.5}s" />{/each}
    </g>
  {/if}
  {#if sunUp}
    <circle cx={sun.x} cy={sun.y} r={sun.r * 1.5} fill={sun.c} opacity="0.35" />
    <circle cx={sun.x} cy={sun.y} r={sun.r} fill={sun.c} />
  {:else if s.phase === "dusk" && !s.rain}
    <ellipse cx={W * 0.7} cy={H * hz} rx={W * 0.5} ry={H * 0.05} fill="#E58A4E" opacity="0.45" />
  {:else if s.phase === "night" && !s.rain}
    <circle cx={W * 0.74} cy={H * hz * 0.3} r={18 * u} fill="#F4EEDC" />
    <circle cx={W * 0.74 + 8 * u} cy={H * hz * 0.3 - 4 * u} r={16 * u} fill={bands[1]} />
  {/if}
  {#if s.rain}
    <g fill="#5C6673" opacity="0.8">
      <ellipse cx={W * 0.25} cy={H * hz * 0.22} rx={W * 0.4} ry={H * 0.06} /><ellipse cx={W * 0.8} cy={H * hz * 0.3} rx={W * 0.45} ry={H * 0.07} />
    </g>
  {/if}
  <path d="M0 {H * hz} C {W * 0.2} {H * (hz - 0.07)}, {W * 0.4} {H * (hz - 0.01)}, {W * 0.6} {H * (hz - 0.06)} S {W * 0.85} {H * (hz - 0.02)}, {W} {H * (hz - 0.07)} L {W} {H} L 0 {H} Z" fill="#3D4F66" />
  <path d="M0 {H * (hz + 0.06)} C {W * 0.25} {H * (hz + 0.01)}, {W * 0.5} {H * (hz + 0.08)}, {W * 0.7} {H * (hz + 0.03)} S {W * 0.9} {H * (hz + 0.05)}, {W} {H * (hz + 0.02)} L {W} {H} L 0 {H} Z" fill="#2F6B52" />
  <path d="M0 {H * (hz + 0.2)} C {W * 0.3} {H * (hz + 0.15)}, {W * 0.6} {H * (hz + 0.24)}, {W} {H * (hz + 0.17)} L {W} {H} L 0 {H} Z" fill="#1F4D3A" />
  {#if people}<path d="M{W * 0.2} {H} C {W * 0.32} {H * 0.9}, {W * 0.46} {H * 0.9}, {benchX + W * 0.02} {benchY + 8} L {benchX + W * 0.08} {benchY + 8} C {W * 0.54} {H * 0.92}, {W * 0.44} {H * 0.98}, {W * 0.4} {H} Z" fill="#E8DFCE" opacity="0.9" />{/if}
  {#each trees as [x, h, w, k], i}
    <g class="tree" style:animation-delay="{i * -0.9}s">
      <rect x={W * x} y={H * (hz + 0.2 - h)} width={w} height={H * h + 20} fill="#FBF8F2" />
      <circle cx={W * x - 6 * u} cy={H * (hz + 0.2 - h)} r={20 * k * Math.max(1, u)} fill="#F2B33D" />
      <circle cx={W * x + 14 * k * u} cy={H * (hz + 0.2 - h) + 8 * k * u} r={16 * k * Math.max(1, u)} fill="#E2622A" />
    </g>
  {/each}
  {#if people}
    <g fill="#211A16">
      <rect x={benchX} y={benchY - 0.02 * H} width="64" height="5" rx="2" /><rect x={benchX} y={benchY} width="64" height="5" rx="2" />
      <rect x={benchX + 4} y={benchY} width="4" height="12" /><rect x={benchX + 56} y={benchY} width="4" height="12" />
      <circle cx={benchX + 18} cy={benchY - 26} r="7" /><rect x={benchX + 10} y={benchY - 18} width="16" height="24" rx="7" />
      <circle cx={benchX + 40} cy={benchY - 30} r="7" /><rect x={benchX + 32} y={benchY - 22} width="16" height="28" rx="7" />
      <circle cx={benchX + 112} cy={benchY - 44} r="7" /><rect x={benchX + 104} y={benchY - 36} width="16" height="40" rx="7" />
    </g>
    <g transform="translate({benchX + 66} {benchY - 46}) scale(0.4)">
      <path fill-rule="evenodd" d={flameD} fill="#E2622A" /><circle cx={HOLE.cx} cy={HOLE.cy} r="6" fill="#F2B33D" />
    </g>
  {/if}
  {#if veil}<rect y={H * (hz - 0.08)} width={W} height={H * (1.08 - hz)} fill={s.rain ? "#39424D" : "#0B1226"} opacity={veil} />{/if}
  {#each leafy ? leaves : [] as [x, y, r], i}
    <g class="leaf" style:animation-delay="{i * -1.3}s">
      <path d={LEAF} fill={["#E2622A", "#F2B33D", "#9E2C17"][i % 3]} transform="translate({W * x} {H * y}) rotate({r} 10 10) scale(1.1)" />
    </g>
  {/each}
  {#if s.rain}
    <g class="drops" stroke="#DDE6EE" stroke-width={Math.max(1, u)} stroke-linecap="round" opacity="0.55">
      {#each dropAt as [x, y], i}<line x1={x * W} y1={y * H} x2={x * W - (s.windy ? 6 : 2) * u} y2={y * H + 14 * u} style:animation-delay="{-(i % 9) * 0.09}s" />{/each}
    </g>
  {/if}
</svg>

<style>
  .scenery { width: 100%; height: 100%; display: block; }
  .stars circle { animation: twinkle 3.2s ease-in-out infinite; }
  .tree { transform-box: fill-box; transform-origin: 50% 100%; }
  .windy .tree { animation: sway 2.6s ease-in-out infinite; }
  .windy .leaf { animation: blow 5s linear infinite; }
  .drops line { animation: fall 0.8s linear infinite; }
  :global(.scenery[data-paused] *) { animation-play-state: paused; }
  @keyframes twinkle { 50% { opacity: 0.35; } }
  @keyframes sway { 0%, 100% { transform: rotate(-1.6deg); } 50% { transform: rotate(2.4deg); } }
  @keyframes blow { from { transform: translate(-30px, -10px); opacity: 0; } 15%, 85% { opacity: 1; } to { transform: translate(90px, 40px); opacity: 0; } }
  @keyframes fall { from { transform: translate(0, -40px); } to { transform: translate(-6px, 60px); } }
  /* Reduced motion: a still picture; the rain stays as streaks so it still reads as rain. */
  @media (prefers-reduced-motion: reduce) { .scenery * { animation: none !important; } }
  :global([data-reduce-motion]) .scenery * { animation: none !important; }
</style>
