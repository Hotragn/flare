<!--
  Talking compass (SRS-CMP-1..7). Feels like following a warm light:
  - the pointer is the brand pin-flame, turned toward your friend;
  - three distance rings pull in as you get closer (one ring per halving of distance);
  - facing within 15° lights the flame and its glow, with a tick (haptic or tone).
  bearing: degrees relative to where the phone points (0 = ahead).
-->
<script lang="ts">
  import { FLAME, HOLE, ring as ringPath } from "../brand";
  let { name = "Fuego", meters = 400, bearing = -18, status = "pointing" }: { name?: string; meters?: number; bearing?: number; status?: "pointing" | "facing" | "no-orientation" | "no-gps" } = $props();
  const facing = $derived(status === "facing" || (status === "pointing" && Math.abs(bearing) < 15));
  const dir = $derived(Math.abs(bearing) < 15 ? "straight ahead" : Math.abs(bearing) < 45 ? (bearing < 0 ? "slightly left" : "slightly right") : bearing < 0 ? "to your left" : "to your right");
  const spoken = $derived(status === "no-gps" ? "Can't find you yet." : status === "no-orientation" ? `${name}, ${meters} meters.` : `${name}, ${meters} meters, ${dir}.`);
  // Closeness 0 (far, 800 m+) to 1 (here). Rings tighten toward the flame.
  const close = $derived(Math.max(0, Math.min(1, 1 - Math.log2(Math.max(meters, 25) / 25) / 5)));
  const flameD = `${FLAME} ${ringPath(HOLE.cx, HOLE.cy, HOLE.r)}`;
</script>

<div class="compass" class:facing>
  <div class="dial" aria-hidden="true" style:--close={close}>
    <svg viewBox="0 0 240 240">
      {#each [0, 1, 2] as i}
        <circle class="ring" cx="120" cy="120" r={112 - i * 22 - close * 30} style:opacity={0.35 + i * 0.2} />
      {/each}
      <circle class="glow" cx="120" cy="120" r="70" />
      {#if status === "pointing" || status === "facing"}
        <g class="pointer" transform="rotate({bearing} 120 120)">
          <!-- The pin-flame, tip forward. Its hole sits on the dial's centre. -->
          <g transform="translate(120 120) scale(1.15) translate(-50 -67)">
            <path fill-rule="evenodd" d={flameD} fill="var(--lit)" />
            {#if facing}<circle cx={HOLE.cx} cy={HOLE.cy} r="6.5" fill="var(--c-gold-400)" />{/if}
          </g>
        </g>
      {:else}
        <g transform="translate(120 120) scale(1.15) translate(-50 -67)" opacity="0.35">
          <path fill-rule="evenodd" d={flameD} fill="var(--gone)" />
        </g>
      {/if}
    </svg>
  </div>
  <p class="dist t-display">{status === "no-gps" ? "Finding you…" : `${meters} m`}</p>
  <p class="t-sun spoken" aria-live="polite">{facing && status !== "no-orientation" ? `${name} is straight ahead.` : spoken}</p>
  {#if status === "no-orientation"}<p class="t-muted">Hold your phone flat to get a direction.</p>{/if}
</div>

<style>
  .compass { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
  .dial { width: 260px; height: 260px; }
  .dial svg { width: 100%; height: 100%; overflow: visible; }
  .ring { fill: none; stroke: var(--lit); stroke-width: 3; transition: r var(--dur-slow) var(--ease-out); }
  .glow { fill: color-mix(in srgb, var(--c-gold-400) 0%, transparent); transition: fill var(--dur-base); }
  .facing .glow { fill: color-mix(in srgb, var(--c-gold-400) 30%, transparent); animation: breathe 1.8s var(--ease-in-out) infinite; }
  
  .dist, .spoken { margin: 0; }
  @keyframes breathe { 50% { opacity: 0.6; } }
  @media (prefers-reduced-motion: reduce) { .facing .glow { animation: none; } }
</style>
