<!--
  The flame: Flare's main status visual.
  state: kindling | lit | ember | gone. progress (0..1) grows Kindling from 55% to 90% of full size.
  Two renderers, one look (spec: docs/design/motion.md section 2):
  - live WebGL shader on the brand silhouette, when WebGL works, motion is allowed,
    the flame is 72 px or larger and fewer than 4 live flames are on the page;
  - this SVG with CSS motion otherwise (and always under reduced motion, in exports,
    and as the first paint before the shader starts).
  intro: play this state's entry (step, catch, settle, drift) when it mounts.
  Ember and Gone play theirs by default; Kindling and Lit only when asked.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { FLAME, HOLE, DOME, ring, type FlameState } from "#lib/brand.ts";
  import { reducedMotion, onReducedMotionChange } from "#lib/motion/core.ts";

  let {
    state: st = "lit",
    progress = 0,
    size = 120,
    dot = true,
    animate = true,
    label = "",
    intro = undefined,
    mode = "auto",
    dprCap = 2,
    onrenderer,
  }: {
    state?: FlameState;
    progress?: number;
    size?: number;
    dot?: boolean;
    animate?: boolean;
    label?: string;
    intro?: boolean;
    mode?: "auto" | "webgl" | "css";
    dprCap?: number;
    onrenderer?: (r: import("#lib/motion/flame-gl.ts").FlameGL | null, why: string) => void;
  } = $props();

  const scale = $derived(st === "kindling" ? 0.55 + 0.35 * Math.min(1, Math.max(0, progress)) : 1);
  const color = $derived(
    st === "kindling" ? "var(--kindling)" : st === "lit" ? "var(--lit)" : st === "ember" ? "var(--ember)" : "var(--gone)",
  );
  const flameD = `${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`;
  const emberD = `${DOME} ${ring(50, 81, 8)}`;
  const names: Record<FlameState, string> = { kindling: "Kindling", lit: "Lit", ember: "Ember", gone: "Gone" };
  const name = $derived(label || names[st]);

  // Entry motion for the CSS flame. On mount: intro, or Ember and Gone by default.
  // After mount: every state change plays the change into the new state.
  const introOnMount = untrack(() => intro ?? (st === "ember" || st === "gone"));
  let entry = $state(untrack(() => introOnMount));
  let changed = $state(false);
  let lastState = untrack(() => st);
  let lastProgress = untrack(() => progress);
  $effect(() => {
    if (st !== lastState) { changed = true; entry = true; }
    lastState = st;
  });

  // ---------- live WebGL flame ----------
  let wrap: HTMLSpanElement;
  let canvas: HTMLCanvasElement | undefined = $state();
  let glOn = $state(false);
  let shown = $state(false);
  let gl: import("#lib/motion/flame-gl.ts").FlameGL | null = null;
  let mod: typeof import("#lib/motion/flame-gl.ts") | null = null;
  let held = false;

  function stopGL(why: string) {
    gl?.destroy();
    gl = null;
    if (held) { mod?.releaseSlot(); held = false; }
    glOn = false;
    shown = false;
    if (why !== "unmounted") onrenderer?.(null, why);
  }

  async function startGL() {
    if (glOn) return;
    if (!animate || mode === "css") return onrenderer?.(null, animate ? "css" : "static");
    if (reducedMotion(wrap)) return onrenderer?.(null, "reduced motion");
    if (mode === "auto" && size < 72) return onrenderer?.(null, "small");
    if (mode === "auto" && (document.documentElement.dataset.flame === "css" || new URLSearchParams(location.search).get("flame") === "css"))
      return onrenderer?.(null, "forced css");
    mod = await import("#lib/motion/flame-gl.ts");
    if (!mod.canUseWebGL()) return onrenderer?.(null, "no webgl");
    if (!mod.acquireSlot()) return onrenderer?.(null, "slot limit");
    held = true;
    glOn = true;
    await Promise.resolve();
    await new Promise((r) => requestAnimationFrame(r));
    if (!canvas) return stopGL("unmounted");
    try {
      gl = new mod.FlameGL(canvas, size, { state: st, progress, dprCap }, (why) => { gl = null; stopGL(why); });
      if (introOnMount && !changed) gl.setState(st, progress, { intro: true });
      requestAnimationFrame(() => (shown = true));
      onrenderer?.(gl, "webgl");
    } catch (e) {
      stopGL(`error: ${(e as Error).message}`);
    }
  }

  onMount(() => {
    startGL();
    const off = onReducedMotionChange(() => { if (reducedMotion(wrap)) stopGL("reduced motion"); else startGL(); });
    return () => { off(); stopGL("unmounted"); };
  });

  // Pass state and progress changes to the shader.
  $effect(() => {
    const s = st, p = progress;
    if (gl && (s !== gl.state || p !== lastProgress)) gl.setState(s, p);
    lastProgress = p;
  });
  $effect(() => { gl?.setDprCap(dprCap); });
</script>

<span
  bind:this={wrap}
  class="flame-wrap"
  class:gl-shown={shown}
  role="img"
  aria-label={name}
  style:width="{size}px"
  style:height="{size}px"
>
  <svg
    class="flame {st}"
    class:animate
    class:entry
    class:changed
    width={size}
    height={size}
    viewBox="0 0 100 100"
    aria-hidden="true"
    style:--flame-color={color}
  >
    {#key st}
      <g class="state">
        {#if st === "kindling" || st === "lit"}
          <g class="grow" style:transform="translate(50px, 96px) scale({scale}) translate(-50px, -96px)">
            <g class="catch">
              <g class="flicker">
                <path fill-rule="evenodd" d={flameD} fill="var(--flame-color)" />
                {#if dot && st === "lit"}
                  <circle class="dot" cx={HOLE.cx} cy={HOLE.cy} r="6" fill="var(--c-gold-400)" />
                {/if}
              </g>
            </g>
          </g>
        {:else if st === "ember"}
          <path class="settle" fill-rule="evenodd" d={emberD} fill="var(--flame-color)" />
        {:else}
          <g class="drift" fill="none" stroke="var(--flame-color)">
            <circle cx="50" cy="86" r="7" stroke-width="3" stroke-dasharray="3.2 3.2" opacity="0.7" />
            <path d="M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22" stroke-width="5" stroke-linecap="round" />
            <path d="M66 18 C70 13 67 8 72 3" stroke-width="4" stroke-linecap="round" opacity="0.5" />
          </g>
        {/if}
      </g>
    {/key}
  </svg>
  {#if glOn}
    <canvas bind:this={canvas} class="gl" aria-hidden="true"></canvas>
  {/if}
</span>

<style>
  .flame-wrap { position: relative; display: inline-block; flex: none; vertical-align: bottom; }
  .flame { overflow: visible; display: block; transition: opacity var(--dur-fade) linear; }
  .gl { position: absolute; left: -20%; top: -30%; width: 140%; height: 140%; pointer-events: none; opacity: 0; transition: opacity var(--dur-fade) linear; }
  .gl-shown .gl { opacity: 1; }
  .gl-shown .flame { opacity: 0; }

  /* Kindling step: one notch bigger on the spring curve (about 10% overshoot of the step). */
  .grow { transition: transform var(--dur-base) var(--ease-spring); transform-origin: 0 0; }
  .animate .flicker { transform-origin: 50px 96px; animation: flicker var(--dur-flicker) var(--ease-in-out) infinite; }
  .animate.lit .dot { transform-origin: 50px 67px; animation: glow var(--dur-flicker) var(--ease-in-out) infinite; }
  /* Kindling intro (a yes just landed): one notch up from 86% on the spring curve. */
  .animate.entry.kindling .catch { transform-origin: 50px 96px; animation: step var(--dur-base) var(--ease-spring) both; }
  /* Lit catch, 480 ms: grow to full with one pulse; the gold dot lights at 160 ms. */
  .animate.entry.lit .catch { transform-origin: 50px 96px; animation: catch var(--dur-slow) var(--ease-out) both; }
  .animate.entry.lit .dot { animation: dot-in var(--dur-quick) var(--ease-out) var(--dur-quick) both, glow var(--dur-flicker) var(--ease-in-out) var(--dur-slow) infinite; }
  /* Ember settle, 480 ms: the dome lands from 1.6x height with a soft settle. */
  .animate.entry .settle { transform-origin: 50px 95px; animation: settle var(--dur-slow) var(--ease-settle) both; }
  /* Gone, 900 ms: smoke drifts up and right as it fades in. Then it is still. */
  .animate.entry .drift { animation: drift var(--dur-drift) var(--ease-out) both; }
  @keyframes flicker {
    0%, 100% { transform: scale(1, 1) skewX(0deg); }
    30% { transform: scale(1.015, 0.985) skewX(-1.2deg); }
    60% { transform: scale(0.99, 1.02) skewX(1deg); }
  }
  @keyframes glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.82; } }
  @keyframes step { from { transform: scale(0.86); } to { transform: scale(1); } }
  @keyframes catch { 0% { transform: scale(0.9); } 55% { transform: scale(1.06); } 100% { transform: scale(1); } }
  @keyframes dot-in { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
  @keyframes settle { from { transform: scaleY(1.6); opacity: 0.6; } to { transform: scaleY(1); opacity: 1; } }
  @keyframes drift { from { transform: translate(-4px, 6px); opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  /* Reduced motion: no movement at all. A state change is a 160 ms crossfade. */
  @media (prefers-reduced-motion: reduce) {
    .animate .flicker, .animate .dot, .animate.entry .catch, .animate.entry .settle, .animate.entry .drift { animation: none; }
    .grow { transition: none; }
    .animate.changed .state { animation: fade var(--dur-fade) linear both; }
  }
  :global([data-reduce-motion]) .animate .flicker, :global([data-reduce-motion]) .animate .dot,
  :global([data-reduce-motion]) .animate.entry .catch, :global([data-reduce-motion]) .animate.entry .settle,
  :global([data-reduce-motion]) .animate.entry .drift { animation: none; }
  :global([data-reduce-motion]) .grow { transition: none; }
  :global([data-reduce-motion]) .animate.changed .state { animation: fade var(--dur-fade) linear both; }
</style>
