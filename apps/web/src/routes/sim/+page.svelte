<!-- Virtual Fairlane: a replay of a SIMULATION (made-up friends, real Fairlane paths, the real
     Flare server and engine). Data: static/sim/replay-<seed>.json from `npm run sim`.
     ?seed=42 picks the run; ?export=1 hides the controls for tools/sim/frames.ts. -->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { clock, type Replay, stateAt } from "#lib/sim/replay.ts";
  import type { SimMap } from "#lib/sim/map.ts";

  const TYPE_WORD: Record<string, string> = {
    keen: "Keen",
    lazy: "Lazy (yes once 3 are in)",
    conditional: "Only if a friend goes",
    bench: "Needs a bench every 200 m",
    lowvision: "Low vision (follows the compass)",
    planner: "Planner (sends a Plan)",
  };
  const STATE_WORD: Record<string, string> = {
    kindling: "Kindling",
    lit: "Lit",
    ember: "Ember",
    gone: "Gone",
    deleted: "Deleted",
  };

  let el: HTMLDivElement;
  let replay: Replay | null = $state(null);
  let error = $state("");
  let tick = $state(0);
  let playing = $state(false);
  let speed = $state(8); // ticks per second
  let exporting = $state(false);
  let colors: Record<string, string> = $state({});
  let stateColors: Record<string, string> = $state({});
  let sim: SimMap | null = null;
  let raf = 0;
  let last = 0;

  const t = $derived(replay ? tick * replay.tick_s : 0);
  const pct = (x: number | null) => (x === null ? "none" : `${Math.round(x * 100)}%`);
  const lastTick = $derived(replay ? replay.frames.length - 1 : 0);
  const recent = $derived(replay ? replay.log.filter((l) => l.t <= t).slice(-6).reverse() : []);
  const live = $derived(
    replay
      ? replay.gatherings
          .map((g) => ({ g, st: stateAt(g, t) }))
          .filter((x) => x.st !== null && x.st.state !== "deleted")
      : [],
  );

  function loop(now: number) {
    if (!replay) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (playing) {
      tick = Math.min(lastTick, tick + dt * speed);
      if (tick >= lastTick) playing = false;
    }
    sim?.draw(tick);
    raf = requestAnimationFrame(loop);
  }

  onMount(async () => {
    const q = new URLSearchParams(location.search);
    const seed = /^\d+$/.test(q.get("seed") ?? "") ? q.get("seed") : "42";
    exporting = q.get("export") === "1";
    try {
      const res = await fetch(`/sim/replay-${seed}.json`);
      if (!res.ok) throw new Error(`No replay for seed ${seed}. Run npm run sim -- --seed ${seed}.`);
      replay = (await res.json()) as Replay;
      const m = await import("#lib/sim/map.ts");
      colors = m.TYPE_COLOR;
      stateColors = m.STATE_COLOR;
      sim = await m.createSimMap(el, replay);
      const r = replay;
      // For tools/sim/frames.ts: jump to a tick and wait for the tiles.
      (window as unknown as { __sim: unknown }).__sim = {
        frames: r.frames.length,
        seek: async (k: number) => {
          tick = k;
          sim?.draw(k);
          await sim?.idle();
        },
      };
      raf = requestAnimationFrame(loop);
      if (!exporting) playing = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });
  onDestroy(() => {
    cancelAnimationFrame(raf);
    sim?.destroy();
  });
</script>

<svelte:head>
  <title>Virtual Fairlane (simulation)</title>
  <meta name="description" content="A simulation of made-up friends using Flare on the real Fairlane paths." />
</svelte:head>

<main class:exporting>
  <header>
    <span class="badge" aria-label="This is a simulation">Simulation</span>
    <div>
      <h1>Virtual Fairlane</h1>
      <p>
        {replay ? replay.friends.length : "Made-up"} pretend friends walk the real Fairlane paths and answer through
        the real Flare server. Nobody here is a real person.
      </p>
    </div>
  </header>

  <div class="stage">
    <div class="map" bind:this={el}></div>
    <div class="sim-mark" aria-hidden="true">SIMULATION</div>
    {#if replay}
      <div class="clock" aria-live="off">{clock(t)}</div>
    {/if}
    <p class="osm">© OpenStreetMap contributors</p>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if replay}
    <div class="controls">
      <button type="button" class="play" onclick={() => (playing = !playing)} aria-pressed={playing}>
        {playing ? "Pause" : "Play"}
      </button>
      <label class="scrub">
        <span class="visually-hidden">Time</span>
        <input type="range" min="0" max={lastTick} step="1" bind:value={tick} />
      </label>
      <label class="speed">
        Speed
        <select bind:value={speed}>
          <option value={4}>1 min/s</option>
          <option value={8}>2 min/s</option>
          <option value={20}>5 min/s</option>
          <option value={40}>10 min/s</option>
        </select>
      </label>
    </div>

    <div class="panels">
      <section class="stats" aria-label="Results of this run">
        <h2>This run (seed {replay.seed})</h2>
        <dl>
          <div><dt>Friends</dt><dd>{replay.stats.friends} in {replay.stats.groups} groups</dd></div>
          <div><dt>Flares and Plans</dt><dd>{replay.stats.flares} + {replay.stats.plans}</dd></div>
          <div><dt>Light rate</dt><dd>{pct(replay.stats.light_rate)} ({replay.stats.lit} of {replay.stats.gatherings})</dd></div>
          <div>
            <dt>Ember saves</dt>
            <dd>{pct(replay.stats.ember_save_rate)} ({replay.stats.embers_lit} of {replay.stats.embers})</dd>
          </div>
          <div>
            <dt>Median time to Lit</dt>
            <dd>{replay.stats.median_min_to_lit === null ? "none" : `${replay.stats.median_min_to_lit} min`}</dd>
          </div>
          <div><dt>Headcount</dt><dd>{replay.stats.headcount_total} going, {replay.stats.arrivals} arrived</dd></div>
          <div><dt>Sparks left</dt><dd>{replay.stats.sparks}</dd></div>
          <div>
            <dt>Deletion audit</dt>
            <dd>{replay.stats.audit_pass ? "Pass" : "Fail"}: {replay.stats.audit_expired_rows} rows left</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Right now">
        <h2>Right now</h2>
        {#if live.length === 0}
          <p class="muted">Nothing going on.</p>
        {:else}
          <ul class="live">
            {#each live as { g, st } (g.key)}
              <li>
                <span class="dot" style:background={stateColors[st?.state ?? "gone"]}></span>
                {g.kind === "plan" ? "Plan" : "Flare"} by {replay.friends.find((f) => f.key === g.host)?.name}
                (group {g.group}): <strong>{STATE_WORD[st?.state ?? "gone"]}</strong>{#if st && (st.state === "kindling" || st.state === "ember")}, needs {st.need} more{/if}
              </li>
            {/each}
          </ul>
        {/if}
        <ol class="log">
          {#each recent as l (l.t + l.text)}
            <li><span class="muted">{clock(l.t)}</span> {l.text}</li>
          {/each}
        </ol>
      </section>

      <section aria-label="Who is who">
        <h2>Who is who</h2>
        <ul class="legend">
          {#each Object.entries(TYPE_WORD) as [k, word] (k)}
            <li><span class="dot" style:background={colors[k]}></span>{word}</li>
          {/each}
        </ul>
        <p class="muted">
          Big dots are walking or there. Rings are gatherings: gold Lit, orange Kindling, red Ember (white dots are the
          Ember benches). The server only ever sees sealed text; places here come from the simulation.
        </p>
      </section>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px;
    display: grid;
    gap: 12px;
  }
  header {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.6rem;
  }
  header p {
    margin: 2px 0 0;
    color: var(--text-muted);
  }
  .badge {
    flex: none;
    background: #b91c1c;
    color: #fff;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 1.15rem;
  }
  .stage {
    position: relative;
    height: min(64vh, 620px);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--line);
  }
  .map {
    position: absolute;
    inset: 0;
  }
  .sim-mark {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(185, 28, 28, 0.92);
    color: #fff;
    font-weight: 700;
    letter-spacing: 0.12em;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 1.3rem;
    pointer-events: none;
  }
  .clock {
    position: absolute;
    top: 52px;
    left: 10px;
    background: rgba(17, 17, 17, 0.75);
    color: #fff;
    padding: 4px 10px;
    border-radius: 6px;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .osm {
    position: absolute;
    left: 10px;
    bottom: 6px;
    margin: 0;
    background: rgba(255, 255, 255, 0.85);
    color: #111;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .play {
    min-width: 96px;
    min-height: 44px;
    border-radius: 999px;
    border: 0;
    background: var(--accent-bg);
    color: var(--on-accent);
    font-weight: 700;
  }
  .scrub {
    flex: 1 1 200px;
  }
  .scrub input {
    width: 100%;
  }
  .speed select {
    min-height: 36px;
    margin-left: 6px;
  }
  .panels {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
  section {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 14px;
    min-width: 0;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 1rem;
  }
  dl {
    margin: 0;
    display: grid;
    gap: 4px;
  }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  dt {
    color: var(--text-muted);
  }
  dd {
    margin: 0;
    font-weight: 700;
    text-align: right;
  }
  ul,
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 4px;
  }
  .log {
    margin-top: 10px;
    font-size: 0.9rem;
  }
  .dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 6px;
  }
  .muted {
    color: var(--text-muted);
  }
  .error {
    color: #b91c1c;
  }
  /* Export frames: map only, fixed size, the label stays. */
  .exporting {
    padding: 0;
    max-width: none;
  }
  .exporting header,
  .exporting .controls,
  .exporting .panels {
    display: none;
  }
  .exporting .stage {
    height: 100vh;
    border-radius: 0;
    border: 0;
  }
</style>
