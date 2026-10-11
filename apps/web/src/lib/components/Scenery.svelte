<!-- Golden-hour scene (same art as the DEV cover, brand/tools/covers.mjs): banded
     sky, sun, hills, birches, a path to a bench, friends by a Lit fire. Decorative. -->
<script lang="ts">
  import { FLAME, HOLE, ring } from "../brand";
  let { people = true, width = 400, height = 360 }: { people?: boolean; width?: number; height?: number } = $props();
  const sky = ["#22324D", "#283A57", "#2E4A6B", "#3A4F6D", "#7C5B5E", "#B0643F", "#D6762F", "#EC9A33", "#F2B33D", "#F7CB72"];
  const hz = 0.62;
  const flameD = `${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`;
  const leaves = [[0.18, 0.12, 20], [0.7, 0.18, -30], [0.86, 0.08, 60], [0.4, 0.3, -10], [0.08, 0.86, 40], [0.92, 0.9, 15]];
  const LEAF = "M10 1 L12 6 L16 4 L15 9 L19 10 L15 12 L16 15 L11 13 L10.6 19 L9.4 19 L9 13 L4 15 L5 12 L1 10 L5 9 L4 4 L8 6 Z";
</script>

<svg viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="scenery">
  {#each sky as c, i}<rect y={(i * height * hz) / sky.length} {width} height={(height * hz) / sky.length + 1} fill={c} />{/each}
  <circle cx={width * 0.56} cy={height * hz} r={height * 0.17} fill="#F7CB72" opacity="0.35" />
  <circle cx={width * 0.56} cy={height * hz} r={height * 0.115} fill="#F7CB72" />
  <path d="M0 {height * hz} C {width * 0.2} {height * (hz - 0.07)}, {width * 0.4} {height * (hz - 0.01)}, {width * 0.6} {height * (hz - 0.06)} S {width * 0.85} {height * (hz - 0.02)}, {width} {height * (hz - 0.07)} L {width} {height} L 0 {height} Z" fill="#3D4F66" />
  <path d="M0 {height * (hz + 0.06)} C {width * 0.25} {height * (hz + 0.01)}, {width * 0.5} {height * (hz + 0.08)}, {width * 0.7} {height * (hz + 0.03)} S {width * 0.9} {height * (hz + 0.05)}, {width} {height * (hz + 0.02)} L {width} {height} L 0 {height} Z" fill="#2F6B52" />
  <path d="M0 {height * 0.82} C {width * 0.3} {height * 0.77}, {width * 0.6} {height * 0.86}, {width} {height * 0.79} L {width} {height} L 0 {height} Z" fill="#1F4D3A" />
  <path d="M{width * 0.2} {height} C {width * 0.32} {height * 0.9}, {width * 0.46} {height * 0.9}, {width * 0.56} {height * 0.83} L {width * 0.62} {height * 0.83} C {width * 0.54} {height * 0.92}, {width * 0.44} {height * 0.98}, {width * 0.4} {height} Z" fill="#E8DFCE" opacity="0.9" />
  {#each [[0.86, 0.5, 9], [0.78, 0.36, 7]] as [x, h, w]}
    <rect x={width * x} y={height * (0.82 - h)} width={w} height={height * h + 20} fill="#FBF8F2" />
    <circle cx={width * x - 6} cy={height * (0.82 - h)} r="20" fill="#F2B33D" />
    <circle cx={width * x + 14} cy={height * (0.82 - h) + 8} r="16" fill="#E2622A" />
  {/each}
  {#if people}
    <g fill="#211A16">
      <rect x={width * 0.54} y={height * 0.775} width="64" height="5" rx="2" /><rect x={width * 0.54} y={height * 0.795} width="64" height="5" rx="2" />
      <rect x={width * 0.54 + 4} y={height * 0.795} width="4" height="12" /><rect x={width * 0.54 + 56} y={height * 0.795} width="4" height="12" />
      <circle cx={width * 0.54 + 18} cy={height * 0.735} r="7" /><rect x={width * 0.54 + 10} y={height * 0.755} width="16" height="24" rx="7" />
      <circle cx={width * 0.54 + 40} cy={height * 0.73} r="7" /><rect x={width * 0.54 + 32} y={height * 0.75} width="16" height="28" rx="7" />
      <circle cx={width * 0.54 + 112} cy={height * 0.71} r="7" /><rect x={width * 0.54 + 104} y={height * 0.73} width="16" height="40" rx="7" />
    </g>
    <g transform="translate({width * 0.54 + 66} {height * 0.68}) scale(0.4)">
      <path fill-rule="evenodd" d={flameD} fill="#E2622A" /><circle cx={HOLE.cx} cy={HOLE.cy} r="6" fill="#F2B33D" />
    </g>
  {/if}
  {#each leaves as [x, y, r], i}
    <path d={LEAF} fill={["#E2622A", "#F2B33D", "#9E2C17"][i % 3]} transform="translate({width * x} {height * y}) rotate({r} 10 10) scale(1.1)" />
  {/each}
</svg>

<style>
  .scenery { width: 100%; height: 100%; display: block; }
</style>
