<!--
  Talking compass (SRS-CMP-1..7). Feels like following a warm light:
  - the pointer is the brand pin-flame, turned toward your friend;
  - three distance rings pull in as you get closer (one ring per halving of distance);
  - facing within 15° lights the flame and its glow, with a tick (haptic or tone).
  bearing: degrees relative to where the phone points (0 = ahead).
  Motion (docs/design/motion.md 3.5): the needle follows on a spring; locking on lights
  the dot, sends one ring of light out and starts the breathing glow. Lock at < 15°,
  release at > 25°, so a shaky hand doesn't flicker it.
-->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import { onMount, untrack } from "svelte";
  import { FLAME, HOLE, ring as ringPath } from "../brand";
  import { feedback } from "#lib/motion/feedback.ts";
  import { speechDue, type Spoken } from "#lib/motion/speech.ts";
  import { unwrapAngle } from "#lib/compass/guide.ts";
  let {
    name = "Fuego",
    meters = 400,
    bearing = -18,
    status = "pointing",
    cues = false,
    speak = false,
    onfacing,
  }: {
    name?: string;
    meters?: number;
    bearing?: number;
    status?: "pointing" | "facing" | "near" | "no-orientation" | "no-gps";
    /** Play the facing tick (haptic, or a tone where there is no vibration) when it locks on. Off in static screens. */
    cues?: boolean;
    /** Speak the line with the SRS-CMP-2 cadence (speechSynthesis). */
    speak?: boolean;
    onfacing?: (on: boolean) => void;
  } = $props();

  const lockNow = (b: number, st: string, was: boolean) => st === "facing" || (st === "pointing" && Math.abs(b) < (was ? 25 : 15));
  let locked = $state(untrack(() => lockNow(bearing, status, false)));
  let pulse = $state(0);
  let mounted = false;
  let lastTick = -1e9;
  $effect(() => {
    const next = lockNow(bearing, status, untrack(() => locked));
    if (next === untrack(() => locked)) return;
    locked = next;
    if (!mounted) return;
    onfacing?.(next);
    if (next) {
      pulse += 1;
      const now = performance.now();
      if (cues && now - lastTick > 3000) { lastTick = now; feedback("facing"); }
    }
  });
  onMount(() => { mounted = true; });

  const facing = $derived(locked);
  // The needle turns the short way: 170° to -170° is a 20° turn, never a full spin.
  let shown = $state(untrack(() => bearing));
  $effect(() => {
    shown = unwrapAngle(untrack(() => shown), bearing);
  });
  const a = $derived(Math.abs(bearing));
  const dir = $derived(t(a < 15 ? "compass.dir.ahead" : a < 45 ? (bearing < 0 ? "compass.dir.slightLeft" : "compass.dir.slightRight") : a > 135 ? "compass.dir.behind" : bearing < 0 ? "compass.dir.left" : "compass.dir.right"));
  const km = $derived(meters >= 1000 ? (Math.round(meters / 100) / 10).toString() : "");
  const spoken = $derived(status === "no-gps" ? t("compass.noGps") : status === "near" ? t("compass.near", { name }) : status === "no-orientation" ? t("compass.spokenNoDir", { name, meters }) : km ? t("compass.spokenKm", { name, km, direction: dir }) : t("compass.spoken", { name, meters, direction: dir }));
  // Closeness 0 (far, 800 m+) to 1 (here). Rings tighten toward the flame.
  const close = $derived(Math.max(0, Math.min(1, 1 - Math.log2(Math.max(meters, 25) / 25) / 5)));
  const flameD = `${FLAME} ${ringPath(HOLE.cx, HOLE.cy, HOLE.r)}`;
  const line = $derived(facing && status !== "no-orientation" ? t("compass.ahead", { name }) : spoken);

  // Speech cadence (SRS-CMP-2): again when the bearing moves 30° or more, the distance halves, or 60 s pass.
  let said: Spoken | null = null;
  let clock = $state(0);
  $effect(() => {
    if (!speak) return;
    const id = setInterval(() => (clock = Date.now()), 5000);
    return () => clearInterval(id);
  });
  $effect(() => {
    void clock;
    const now: Spoken = { text: line, bearing, meters, at: Date.now() };
    if (!speak || typeof speechSynthesis === "undefined" || status === "no-gps") return;
    if (!speechDue(said, now)) return;
    said = now;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(now.text));
  });
</script>

<div class="compass" class:facing>
  <div class="dial" aria-hidden="true" style:--close={close}>
    <svg viewBox="0 0 240 240">
      {#each [0, 1, 2] as i}
        <circle class="ring" cx="120" cy="120" r={112 - i * 22 - close * 30} style:opacity={0.35 + i * 0.2} />
      {/each}
      <circle class="glow" cx="120" cy="120" r="70" />
      {#key pulse}{#if pulse}<circle class="lock" cx="120" cy="120" r="70" />{/if}{/key}
      {#if status === "pointing" || status === "facing"}
        <g class="pointer" style:transform="rotate({shown}deg)">
          <!-- The pin-flame, tip forward. Its hole sits on the dial's centre. -->
          <g transform="translate(120 120) scale(1.15) translate(-50 -67)">
            <path fill-rule="evenodd" d={flameD} fill="var(--lit)" />
            {#if facing}<circle class="dot" cx={HOLE.cx} cy={HOLE.cy} r="6.5" fill="var(--c-gold-400)" />{/if}
          </g>
        </g>
      {:else if status === "near"}
        <g class="near" transform="translate(120 120) scale(1.15) translate(-50 -67)">
          <path fill-rule="evenodd" d={flameD} fill="var(--lit)" />
          <circle cx={HOLE.cx} cy={HOLE.cy} r="6.5" fill="var(--c-gold-400)" />
        </g>
      {:else}
        <g transform="translate(120 120) scale(1.15) translate(-50 -67)" opacity="0.35">
          <path fill-rule="evenodd" d={flameD} fill="var(--gone)" />
        </g>
      {/if}
    </svg>
  </div>
  <p class="dist t-display">{status === "no-gps" ? t("compass.finding") : km ? t("compass.distanceKm", { km }) : t("compass.distance", { meters })}</p>
  <p class="t-sun spoken" aria-live="polite">{line}</p>
  {#if status === "no-orientation"}<p class="t-muted">{t("compass.holdFlat")}</p>{/if}
</div>

<style>
  .compass { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
  .dial { width: 260px; height: 260px; }
  .dial svg { width: 100%; height: 100%; overflow: visible; }
  .ring { fill: none; stroke: var(--lit); stroke-width: 3; transition: r var(--dur-slow) var(--ease-out); }
  .glow { fill: color-mix(in srgb, var(--c-gold-400) 0%, transparent); transition: fill var(--dur-base) var(--ease-out); }
  .facing .glow { fill: color-mix(in srgb, var(--c-gold-400) 30%, transparent); animation: breathe var(--dur-breathe) var(--ease-in-out) var(--dur-slow) infinite; }
  /* The needle follows the bearing on a damped spring (about 530 ms, 1% overshoot). */
  .pointer { transform-origin: 120px 120px; transition: transform var(--spring-needle-dur) var(--spring-needle); }
  /* Lock on: the gold dot lights (160 ms), one ring of light goes out (480 ms), then the glow breathes. */
  .dot { transform-box: fill-box; transform-origin: center; animation: dot-in var(--dur-quick) var(--ease-spring) both; }
  .lock { fill: none; stroke: var(--c-gold-400); stroke-width: 6; transform-origin: 120px 120px; animation: lock var(--dur-slow) var(--ease-out) both; pointer-events: none; }
  .dist, .spoken { margin: 0; }
  @keyframes breathe { 50% { opacity: 0.6; } }
  @keyframes dot-in { from { transform: scale(0.3); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes lock { from { transform: scale(1); opacity: 0.9; } to { transform: scale(1.55); opacity: 0; } }
  /* Reduced motion: the needle jumps, no ring of light, no breathing; the glow simply turns on. */
  @media (prefers-reduced-motion: reduce) {
    .facing .glow, .dot { animation: none; }
    .lock { display: none; }
    .pointer, .ring { transition: none; }
  }
  :global([data-reduce-motion]) .facing .glow, :global([data-reduce-motion]) .dot { animation: none; }
  :global([data-reduce-motion]) .lock { display: none; }
  :global([data-reduce-motion]) .pointer, :global([data-reduce-motion]) .ring { transition: none; }
</style>
