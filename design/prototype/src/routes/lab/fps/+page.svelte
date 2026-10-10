<!--
  /lab/fps: flame frame-rate check for the iPhones (Sunday morning).
  Shows live fps, frame-time p95, device pixel ratio and the refresh rate the page
  gets (60 or 120 Hz; 30 means Low Power Mode). "Run 10 s test" gives one result
  row per run; "Copy results" copies them as text.
  Query (used by design/motion/bench.mjs): ?mode=webgl|css&state=lit|cycle&n=1&dpr=2&auto=10
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Flame from "#lib/components/Flame.svelte";
  import type { FlameState } from "#lib/brand.ts";
  import { FrameMeter, summarize, gzipBytes, gpuName, type Summary } from "#lib/motion/meter.ts";
  import { FRAG, VERT } from "#lib/motion/flame-shader.ts";
  import type { FlameGL } from "#lib/motion/flame-gl.ts";

  const states: FlameState[] = ["kindling", "lit", "ember", "gone"];
  let mode = $state<"webgl" | "css">("webgl");
  let flameState = $state<FlameState>("lit");
  let cycle = $state(false);
  let count = $state(1);
  let dpr = $state(2);
  let progress = $state(0.5);
  let renderers = $state<Record<number, string>>({});
  let live = $state<Summary | null>(null);
  let drawMs = $state(0);
  let running = $state(false);
  let left = $state(0);
  let rows = $state<string[]>([]);
  let info = $state({ dpr: 1, screen: "", gpu: "", ua: "", shaderRaw: 0, shaderGz: 0 as number | null });
  let copied = $state("");
  let ready = $state(false);
  let maskMs = $state<number | null>(null);
  let theme = $state<"light" | "dark">("light");
  const gls: Record<number, FlameGL | null> = {};
  const meter = new FrameMeter();

  function onrenderer(i: number) {
    return (r: FlameGL | null, why: string) => { gls[i] = r; renderers = { ...renderers, [i]: why }; };
  }
  function avgDraw() {
    const all = Object.values(gls).flatMap((g) => (g ? g.stats.drawMs.slice(-120) : []));
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  }

  let cycleId: ReturnType<typeof setInterval> | undefined;
  $effect(() => {
    clearInterval(cycleId);
    if (cycle) { let i = 0; cycleId = setInterval(() => { flameState = states[i++ % 4]; }, 3000); }
    return () => clearInterval(cycleId);
  });

  async function test(seconds = 10) {
    if (running) return;
    running = true;
    await new Promise((r) => setTimeout(r, 1000)); // warm-up
    meter.reset();
    for (const g of Object.values(gls)) if (g) g.stats.drawMs = [];
    for (left = seconds; left > 0; left--) await new Promise((r) => setTimeout(r, 1000));
    const s = summarize(meter.dts);
    const which = Object.values(renderers).join("/") || mode;
    const row = `${mode} (${which}) · ${cycle ? "cycle" : flameState} · ${count} flame(s) · DPR cap ${dpr} · ${s.fps} fps · p50 ${s.p50} ms · p95 ${s.p95} ms · p99 ${s.p99} ms · dropped ${s.dropped}/${s.frames} · ${s.refreshHz} Hz · draw ${avgDraw().toFixed(3)} ms`;
    rows = [...rows, row];
    (window as unknown as { __fpsResult: unknown }).__fpsResult = { ...s, mode, renderers: { ...renderers }, state: cycle ? "cycle" : flameState, count, dprCap: dpr, drawMs: +avgDraw().toFixed(4), maskMs, downgrades: Object.values(gls).flatMap((g) => g?.stats.downgrades ?? []) };
    running = false;
  }

  async function copy() {
    const text = [`Flare /lab/fps`, `UA: ${info.ua}`, `Screen: ${info.screen}, DPR ${info.dpr}`, `GPU: ${info.gpu}`, ...rows].join("\n");
    try { await navigator.clipboard.writeText(text); copied = "Copied."; } catch { copied = "Copy failed. Select the text below."; }
  }

  onMount(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("mode") === "css") mode = "css";
    if (q.get("theme") === "dark") theme = "dark";
    if (q.get("state") === "cycle") cycle = true;
    else if (states.includes(q.get("state") as FlameState)) flameState = q.get("state") as FlameState;
    count = Number(q.get("n") ?? 1) || 1;
    dpr = Number(q.get("dpr") ?? 2) || 2;
    info = { dpr: devicePixelRatio, screen: `${screen.width} x ${screen.height}`, gpu: gpuName(), ua: navigator.userAgent, shaderRaw: VERT.length + FRAG.length, shaderGz: null };
    gzipBytes(VERT + FRAG).then((n) => (info.shaderGz = n));
    ready = true;
    import("#lib/motion/flame-gl.ts").then((m) => setTimeout(() => (maskMs = m.maskBuildMs ? +m.maskBuildMs.toFixed(1) : null), 1500));
    meter.start();
    const id = setInterval(() => { live = meter.last(120); drawMs = avgDraw(); }, 500);
    const auto = Number(q.get("auto") ?? 0);
    if (auto) test(auto);
    return () => { clearInterval(id); meter.stop(); };
  });
</script>

<svelte:head><title>Flame frame rate</title></svelte:head>

<main class="lab" data-theme={theme}>
  <h1 class="t-title">Flame frame rate</h1>
  <p class="t-small t-muted">Open on each iPhone. Run each test with the phone still and the screen bright. Then tap Copy results and paste them into the team chat.</p>

  <section class="stage" aria-label="Flames under test">
    {#if ready}{#key `${mode}-${count}`}
      {#each Array(count) as _, i}
        <Flame state={flameState} {progress} size={count > 1 ? 120 : 200} mode={mode} dprCap={dpr} onrenderer={onrenderer(i)} />
      {/each}
    {/key}{/if}
  </section>

  <dl class="live" aria-live="off">
    <div><dt>fps</dt><dd>{live?.fps ?? "…"}</dd></div>
    <div><dt>p95 frame</dt><dd>{live ? `${live.p95} ms` : "…"}</dd></div>
    <div><dt>Refresh</dt><dd>{live ? `${live.refreshHz} Hz` : "…"}</dd></div>
    <div><dt>DPR</dt><dd>{info.dpr}</dd></div>
    <div><dt>Shader draw (JS)</dt><dd>{drawMs.toFixed(3)} ms</dd></div>
    <div><dt>Renderer</dt><dd>{Object.values(renderers).join(", ") || mode}</dd></div>
  </dl>

  <fieldset>
    <legend>Renderer</legend>
    <div class="row">
      <button aria-pressed={mode === "webgl"} onclick={() => (mode = "webgl")}>WebGL</button>
      <button aria-pressed={mode === "css"} onclick={() => (mode = "css")}>CSS</button>
    </div>
  </fieldset>
  <fieldset>
    <legend>State</legend>
    <div class="row">
      {#each states as s}<button aria-pressed={!cycle && flameState === s} onclick={() => { cycle = false; flameState = s; }}>{s}</button>{/each}
      <button aria-pressed={cycle} onclick={() => (cycle = !cycle)}>Cycle</button>
      <button onclick={() => { cycle = false; flameState = "kindling"; progress = progress >= 1 ? 0 : Math.min(1, progress + 0.25); }}>Yes +1</button>
    </div>
  </fieldset>
  <fieldset>
    <legend>Flames on screen</legend>
    <div class="row">{#each [1, 3, 4] as n}<button aria-pressed={count === n} onclick={() => (count = n)}>{n}</button>{/each}</div>
  </fieldset>
  <fieldset>
    <legend>Pixel ratio cap</legend>
    <div class="row">{#each [1, 2, 3] as n}<button aria-pressed={dpr === n} onclick={() => (dpr = n)}>{n}</button>{/each}</div>
  </fieldset>

  <div class="row">
    <button class="main" onclick={() => test(10)} disabled={running}>{running ? `Testing… ${left} s` : "Run 10 s test"}</button>
    <button class="main" onclick={copy} disabled={!rows.length}>Copy results</button>
  </div>
  <p role="status" class="t-small">{copied}</p>

  <h2 class="t-heading">Results</h2>
  <ol class="rows">{#each rows as r}<li>{r}</li>{/each}</ol>

  <h2 class="t-heading">This device</h2>
  <ul class="t-small facts">
    <li>Screen {info.screen}, device pixel ratio {info.dpr}</li>
    <li>GPU: {info.gpu}</li>
    <li>Shader source: {info.shaderRaw} bytes, {info.shaderGz ?? "?"} bytes gzipped</li>
    <li>Mask texture build (once per page): {maskMs ?? "not built"} ms</li>
    <li class="ua">{info.ua}</li>
  </ul>
  <p class="t-small t-muted">Safari renders pages near 60 fps unless the Safari feature flag "Prefer Page Rendering Updates near 60fps" is off. Low Power Mode caps it at 30 fps. Both are normal.</p>
</main>

<style>
  .lab { max-width: 640px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; background: var(--bg); min-height: 100vh; }
  .stage { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; align-items: flex-end; padding: 40px 0 16px; min-height: 260px; }
  .live { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
  .live div { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 10px; }
  .live dt { font-size: 0.8rem; color: var(--text-muted); }
  .live dd { margin: 0; font-weight: 700; font-size: 1.2rem; font-variant-numeric: tabular-nums; }
  fieldset { border: 0; padding: 0; margin: 0; }
  legend { font-weight: 700; margin-bottom: 6px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: var(--r-pill); border: 2px solid var(--text); background: transparent; font-weight: 700; text-transform: capitalize; }
  button[aria-pressed="true"] { background: var(--accent-bg); color: var(--on-accent); border-color: var(--accent-bg); }
  .main { background: var(--accent-bg); color: var(--on-accent); border-color: var(--accent-bg); text-transform: none; }
  button:disabled { opacity: 0.5; }
  .rows { margin: 0; padding-left: 20px; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .facts { margin: 0; padding-left: 20px; }
  .ua { word-break: break-all; }
  @media (max-width: 420px) { .live { grid-template-columns: repeat(2, 1fr); } }
</style>
