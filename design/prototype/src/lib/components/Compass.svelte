<!-- Talking compass (SRS-CMP-1..7). bearing: degrees relative to where the phone points (0 = ahead). -->
<script lang="ts">
  let { name = "Fuego", meters = 400, bearing = -18, status = "pointing" }: { name?: string; meters?: number; bearing?: number; status?: "pointing" | "facing" | "no-orientation" | "no-gps" } = $props();
  const dir = $derived(Math.abs(bearing) < 15 ? "straight ahead" : Math.abs(bearing) < 45 ? (bearing < 0 ? "slightly left" : "slightly right") : bearing < 0 ? "to your left" : "to your right");
  const spoken = $derived(status === "no-gps" ? "Can't find you yet." : `${name}, ${meters} meters, ${status === "no-orientation" ? "" : dir}`.replace(/, $/, "."));
</script>

<div class="compass" class:facing={status === "facing"}>
  <div class="dial" aria-hidden="true">
    {#if status === "pointing" || status === "facing"}
      <svg viewBox="0 0 200 200" style:transform="rotate({bearing}deg)">
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--line)" stroke-width="4" />
        <path d="M100 18 L132 112 L100 96 L68 112 Z" fill="var(--lit)" />
      </svg>
    {:else}
      <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke="var(--line)" stroke-width="4" stroke-dasharray="10 10" /></svg>
    {/if}
  </div>
  <p class="dist t-display">{status === "no-gps" ? "…" : `${meters} m`}</p>
  <p class="t-sun spoken" aria-live="polite">{spoken}</p>
  {#if status === "no-orientation"}<p class="t-muted">Hold your phone flat.</p>{/if}
</div>

<style>
  .compass { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
  .dial { width: 220px; height: 220px; }
  .dial svg { width: 100%; height: 100%; transition: transform var(--dur-base) var(--ease-out); }
  .facing .dial svg circle { stroke: var(--lit); }
  .dist, .spoken { margin: 0; }
</style>
