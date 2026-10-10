<!--
  /lab/haptics: haptics and sound check for the iPhones (Sunday morning).
  Code cannot detect a haptic, so each test asks the person holding the phone:
  "Felt it" or "Nothing". Copy results gives one plain-text report.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { haptic, hapticTap, support, hlog } from "#lib/motion/haptics.ts";
  import { playWhenReady, unlock, audioInfo, isMuted, setMuted, type SoundName } from "#lib/motion/sound.ts";

  type Row = { test: string; result: string };
  // Adds the iOS 17.4+ "switch" attribute (not in the TypeScript DOM types yet).
  const asSwitch = (el: HTMLInputElement) => { el.setAttribute("switch", ""); };
  let rows = $state<Row[]>([]);
  let sup = $state({ vibrate: false, switchInput: false, userActivation: false });
  let audio = $state<ReturnType<typeof audioInfo> | null>(null);
  let ua = $state("");
  let muted = $state(false);
  let copied = $state("");
  let used = $state<Record<string, string>>({});

  const tests = [
    { id: "native", name: "1. Tap the switch itself", how: "A real iOS switch. Tap it. This is the baseline: if you feel nothing here, System Haptics is off in Settings, Sounds & Haptics." },
    { id: "overlay", name: "2. Button with switch overlay", how: "Flare's way on iOS 26.5 and later: your finger taps a hidden switch laid over the button." },
    { id: "script", name: "3. Button with script click", how: "The older trick: the button's code clicks a hidden switch. Reported to stop working in iOS 26.5." },
    { id: "vibrate", name: "4. navigator.vibrate", how: "Android Chrome only. Safari has no vibrate, so expect nothing on iPhone." },
  ];

  function record(test: string, result: string) {
    rows = [...rows.filter((r) => r.test !== test), { test, result }];
  }
  function refresh() { audio = audioInfo(); }

  function runScript() { used = { ...used, script: haptic("tap") }; }
  function runVibrate() {
    const ok = typeof navigator.vibrate === "function" ? navigator.vibrate(30) : false;
    used = { ...used, vibrate: ok ? "vibrate called" : "not available" };
  }
  function sound(n: SoundName) {
    unlock();
    playWhenReady(n, 1500).then((ok) => { record(`sound ${n}`, ok ? "played (did you hear it?)" : "did not play (muted or locked; tap again)"); refresh(); });
  }

  async function copy() {
    const text = [
      "Flare /lab/haptics",
      `UA: ${ua}`,
      `vibrate: ${sup.vibrate}, switch input: ${sup.switchInput}, userActivation: ${sup.userActivation}`,
      `audio: ${JSON.stringify(audio)}`,
      ...rows.map((r) => `${r.test}: ${r.result}`),
      `log: ${hlog.join("; ")}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(text); copied = "Copied."; } catch { copied = "Copy failed. Select the text below."; }
  }

  onMount(() => { sup = support(); ua = navigator.userAgent; muted = isMuted(); refresh(); });
</script>

<svelte:head><title>Haptics check</title></svelte:head>

<main class="lab" data-theme="light">
  <h1 class="t-title">Haptics and sound</h1>
  <p class="t-small t-muted">For iPhone Safari. Turn the ring switch to ring, volume up. For each test, do it, then answer. Then tap Copy results.</p>
  <ul class="facts t-small">
    <li>Switch input supported: <b>{sup.switchInput ? "yes" : "no"}</b> (needs iOS 17.4 or later)</li>
    <li>navigator.vibrate: <b>{sup.vibrate ? "yes" : "no"}</b></li>
    <li>User activation API: <b>{sup.userActivation ? "yes" : "no"}</b></li>
  </ul>

  {#each tests as t}
    <section class="card" aria-labelledby="h-{t.id}">
      <h2 class="t-heading" id="h-{t.id}">{t.name}</h2>
      <p class="t-small">{t.how}</p>
      {#if t.id === "native"}
        <label class="switch-row"><input type="checkbox" use:asSwitch /> <span>Real switch</span></label>
      {:else if t.id === "overlay"}
        <button class="main" use:hapticTap={"tap"} onclick={() => (used = { ...used, overlay: "tapped" })}>Tap me</button>
      {:else if t.id === "script"}
        <button class="main" onclick={runScript}>Tap me</button>
      {:else}
        <button class="main" onclick={runVibrate}>Tap me</button>
      {/if}
      {#if used[t.id]}<p class="t-small t-muted">Code: {used[t.id]}</p>{/if}
      <div class="row">
        <button aria-pressed={rows.find((r) => r.test === t.name)?.result === "felt it"} onclick={() => record(t.name, "felt it")}>Felt it</button>
        <button aria-pressed={rows.find((r) => r.test === t.name)?.result === "nothing"} onclick={() => record(t.name, "nothing")}>Nothing</button>
      </div>
    </section>
  {/each}

  <section class="card" aria-labelledby="h-sound">
    <h2 class="t-heading" id="h-sound">5. Sounds</h2>
    <p class="t-small">Play each one. Then flip the silent switch on and play "Lit" again: it should stay quiet.</p>
    <div class="row">
      <button onclick={() => sound("yes")}>Yes tick</button>
      <button onclick={() => sound("lit")}>Lit</button>
      <button onclick={() => sound("ember")}>Ember</button>
      <button onclick={() => sound("facing")}>Facing</button>
    </div>
    <div class="row">
      <button onclick={() => record("silent switch on, Lit", "silent (correct)")}>Silent with switch on</button>
      <button onclick={() => record("silent switch on, Lit", "still heard")}>Still heard</button>
    </div>
    <label class="switch-row"><input type="checkbox" checked={muted} onchange={(e) => { muted = (e.currentTarget as HTMLInputElement).checked; setMuted(muted); refresh(); }} /> <span>Mute Flare sounds</span></label>
    {#if audio}
      <p class="t-small t-muted">Audio: {audio.context} · {audio.sampleRate} Hz · base latency {audio.baseLatencyMs ?? "?"} ms · output latency {audio.outputLatencyMs ?? "?"} ms · session {audio.audioSession}</p>
    {/if}
  </section>

  <div class="row">
    <button class="main" onclick={copy}>Copy results</button>
  </div>
  <p role="status" class="t-small">{copied}</p>
  <ol class="t-small">{#each rows as r}<li>{r.test}: {r.result}</li>{/each}</ol>
  <p class="t-small ua">{ua}</p>
</main>

<style>
  .lab { max-width: 640px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; background: var(--bg); min-height: 100vh; }
  .facts { margin: 0; padding-left: 20px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .card p { margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 44px; min-width: 44px; padding: 0 16px; border-radius: var(--r-pill); border: 2px solid var(--text); background: transparent; font-weight: 700; }
  button[aria-pressed="true"] { background: var(--positive); color: var(--c-birch-50); border-color: var(--positive); }
  .main { background: var(--accent-bg); color: var(--on-accent); border-color: var(--accent-bg); min-height: 56px; }
  .switch-row { display: flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 700; }
  .switch-row input { width: 28px; height: 28px; }
  .ua { word-break: break-all; color: var(--text-muted); }
</style>
