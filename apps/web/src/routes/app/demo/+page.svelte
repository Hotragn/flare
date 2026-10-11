<!-- Try-it demo: a judge alone plays a Flare with three demo friends (backlog #4). The real
     engine on a demo clock (lib/demo/demo.svelte.ts) and the real screens; nothing is sent. -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { t } from "#lib/copy/index.ts";
  import Button from "#lib/components/Button.svelte";
  import H3Send from "#lib/screens/H3Send.svelte";
  import H5HostKindling from "#lib/screens/H5HostKindling.svelte";
  import I6Lit from "#lib/screens/I6Lit.svelte";
  import I7Compass from "#lib/screens/I7Compass.svelte";
  import I11Spark from "#lib/screens/I11Spark.svelte";
  import I12Outside from "#lib/screens/I12Outside.svelte";
  import { DEMO_BENCHES, DEMO_FRIENDS, DEMO_SCENE, DEMO_SPOT, DEMO_WORDS, DemoEngine } from "#lib/demo/demo.svelte.ts";
  import type { InviteInfo } from "#lib/components/parts.ts";

  type Step = "send" | "kindling" | "lit" | "compass" | "spark" | "outside";
  const demo = new DemoEngine();
  let step = $state<Step>("send");
  let quorum = $state("4");
  let toast = $state("");
  let bearing = $state(40);
  let litAt = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  onDestroy(() => timers.forEach(clearTimeout));

  const say = (name: string) => {
    toast = t("demo.said", { name });
    later(2200, () => (toast = ""));
  };
  function send() {
    demo.start(Number(quorum));
    step = "kindling";
    // Amor answers first; with 4 needed it stays Kindling until you skip ahead.
    later(1800, () => {
      demo.yes(DEMO_FRIENDS[0].id);
      say(DEMO_FRIENDS[0].name);
      if (demo.g?.state === "lit") toLit();
    });
  }
  function skip() {
    demo.advance(30 * 60_000 + 1000); // the real 30-minute Ember rule
    // Amor's phone checks both benches; Benny says yes to the smaller plan.
    demo.event({ type: "checks", member_id: DEMO_FRIENDS[0].id, results: { c1: true, c2: true } });
    later(1500, () => {
      demo.yes(DEMO_FRIENDS[1].id);
      say(DEMO_FRIENDS[1].name);
      demo.advance(61_000);
      if (demo.g?.state === "lit") toLit();
    });
  }
  function toLit() {
    litAt = demo.now;
    step = "lit";
  }
  function compass() {
    step = "compass";
    // A friend turning toward the spot: the bearing eases to straight ahead.
    const sweep = () => {
      bearing = Math.round(bearing * 0.8);
      if (Math.abs(bearing) > 2 && step === "compass") later(400, sweep);
    };
    later(600, sweep);
  }
  function here() {
    demo.event({ type: "arrival", by: DEMO_FRIENDS[0].id, who: { for: "self" }, recorded_at: new Date(demo.now).toISOString() });
    step = "spark";
  }
  function outside() {
    demo.advance(34 * 60_000); // 34 demo minutes outside, then the host ends it
    demo.event({ type: "done", by: "00000000-0000-4000-8000-0000000000a0" });
    step = "outside";
  }

  const bench = $derived(demo.g?.ember_choice ? (DEMO_BENCHES[demo.g.ember_choice] ?? DEMO_SPOT) : DEMO_SPOT);
  const info: InviteInfo = $derived({
    host: "Fuego",
    words: DEMO_WORDS,
    scene: DEMO_SCENE,
    photo: "/demo/pond.jpg",
    spot: bench,
    hostLine: `Fuego is waiting at ${bench}.`,
    walkMin: 6,
    access: { benches: { count: 2, nearest_m: 0 }, restrooms: { count: 1, nearest_m: 180 }, water: { count: 0, nearest_m: null }, steps_mapped: false },
    nature: "",
    met: null,
  } as InviteInfo);
  const minutes = $derived(litAt ? Math.round((demo.now - litAt) / 60_000) : 34);
</script>

<svelte:head><title>{t("demo.badge")}</title></svelte:head>

<div class="demo">
  <p class="badge" role="status">{t("demo.badge")}</p>
  {#if toast}<p class="toast" role="status">{toast}</p>{/if}

  {#if step === "send"}
    <H3Send words={DEMO_WORDS} photo="/demo/pond.jpg" scene={DEMO_SCENE} spot={DEMO_SPOT} bind:quorum onsend={send} onclose={() => history.back()} />
  {:else if step === "kindling"}
    <div class="layer">
      <H5HostKindling photo="/demo/pond.jpg" scene={DEMO_SCENE} view={demo.have() > 1 ? "growing" : "zero"} have={demo.have()} quorum={demo.g?.quorum ?? 4} sentMin={0} hostLine={`Fuego is waiting at ${DEMO_SPOT}.`} onclose={() => history.back()} />
      {#if demo.g?.state === "kindling" && demo.have() > 1}
        <div class="control"><p>{t("demo.shrinkHint")}</p><Button onclick={skip}>{t("demo.skip")}</Button></div>
      {:else if demo.g?.state === "ember"}
        <div class="control"><p>{t("ember.headline", { bench })}</p></div>
      {/if}
    </div>
  {:else if step === "lit"}
    <div class="layer">
      <I6Lit view={demo.g?.ember_choice ? "smaller" : "lit"} {info} smallerAt={bench} onfind={compass} onhere={here} onclose={() => history.back()} />
      <div class="control top"><Button variant="secondary" onclick={compass}>{t("demo.asFriend")}</Button></div>
    </div>
  {:else if step === "compass"}
    <I7Compass name="Fuego" status={Math.abs(bearing) <= 15 ? "facing" : "pointing"} meters={120} {bearing} onhere={here} onclose={() => (step = "lit")} />
  {:else if step === "spark"}
    <I11Spark onsave={outside} onskip={outside} />
  {:else}
    <I12Outside view="end" {minutes} onclose={() => (step = "send")} />
  {/if}
</div>

<style>
  .demo { position: fixed; inset: 0; }
  .layer { position: absolute; inset: 0; }
  .badge { position: fixed; top: calc(env(safe-area-inset-top, 0) + 14px); left: 12px; z-index: 30; margin: 0;
    padding: 6px 14px; border-radius: 999px; background: #fff; color: #111; font-weight: 700; font-size: 0.875rem; box-shadow: 0 2px 10px rgb(0 0 0 / 0.25); }
  .toast { position: fixed; top: calc(env(safe-area-inset-top, 0) + 56px); left: 50%; transform: translateX(-50%); z-index: 30; margin: 0;
    padding: 10px 18px; border-radius: 999px; background: var(--c-gold-400); color: #111; font-weight: 700; }
  .control { position: absolute; left: 16px; right: 16px; bottom: 168px; z-index: 25; display: flex; flex-direction: column; gap: 8px; align-items: stretch;
    padding: 14px; border-radius: 20px; background: rgb(255 255 255 / 0.94); color: #111; box-shadow: 0 8px 30px rgb(0 0 0 / 0.3); }
  .control.top { bottom: auto; top: calc(env(safe-area-inset-top, 0) + 100px); }
  .control p { margin: 0; font-weight: 600; }
</style>
