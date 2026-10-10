<!--
  /lab/motion: every micro-interaction from docs/design/motion.md, live, with sound
  and haptics. Toggle "Reduce motion" to see the reduced version of each.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Hearth from "#lib/components/Hearth.svelte";
  import FlameMeter from "#lib/components/FlameMeter.svelte";
  import PhotoPrint from "#lib/components/PhotoPrint.svelte";
  import TypeWords from "#lib/components/TypeWords.svelte";
  import Compass from "#lib/components/Compass.svelte";
  import Sheet from "#lib/components/Sheet.svelte";
  import Button from "#lib/components/Button.svelte";
  import type { FlameState } from "#lib/brand.ts";
  import { feedback } from "#lib/motion/feedback.ts";
  import { kindlingProgress } from "#lib/motion/core.ts";
  import { isMuted, setMuted } from "#lib/motion/sound.ts";

  let quorum = $state(4);
  let have = $state(1);
  let fstate = $state<FlameState>("kindling");
  const progress = $derived(fstate === "kindling" ? kindlingProgress(have, quorum) : 1);
  let celebrate = $state(false);
  let develop = $state(0);
  let bearing = $state(-60);
  let meters = $state(400);
  let speak = $state(false);
  let sheet = $state(false);
  let reduce = $state(false);
  let sound = $state(true);

  function yes() {
    if (fstate !== "kindling") return;
    have += 1;
    if (have >= quorum) { fstate = "lit"; celebrate = true; feedback("lit"); }
    else feedback("yes", { hapticAttached: true });
  }
  function toEmber() { fstate = "ember"; celebrate = false; feedback("ember"); }
  function toGone() { fstate = "gone"; celebrate = false; feedback("gone"); }
  function reset() { have = 1; fstate = "kindling"; celebrate = false; }
  function setReduce(on: boolean) {
    reduce = on;
    if (on) document.documentElement.setAttribute("data-reduce-motion", "");
    else document.documentElement.removeAttribute("data-reduce-motion");
    try { localStorage.setItem("flare.motion", on ? "reduce" : "full"); } catch { /* ignore */ }
  }
  onMount(() => { reduce = document.documentElement.hasAttribute("data-reduce-motion"); sound = !isMuted(); });
</script>

<svelte:head><title>Motion lab</title></svelte:head>

<main class="lab" data-theme="light">
  <h1 class="t-title">Motion lab</h1>
  <p class="t-small t-muted">Each moment from the motion spec, live. Sound starts after your first tap.</p>
  <div class="row">
    <label class="switch-row"><input type="checkbox" checked={reduce} onchange={(e) => setReduce((e.currentTarget as HTMLInputElement).checked)} /> <span>Reduce motion</span></label>
    <label class="switch-row"><input type="checkbox" checked={sound} onchange={(e) => { sound = (e.currentTarget as HTMLInputElement).checked; setMuted(!sound); }} /> <span>Sound</span></label>
  </div>

  <section class="card" aria-labelledby="h-flame">
    <h2 class="t-heading" id="h-flame">The flame: yes, Lit, Ember, Gone</h2>
    <div class="row">
      <span class="t-small">Quorum</span>
      {#each [2, 3, 4, 5, 6] as q}<button class="chip" aria-pressed={quorum === q} onclick={() => { quorum = q; reset(); }}>{q}</button>{/each}
    </div>
    <Hearth state={fstate} {progress} size={180} {celebrate} horizon={false} />
    <FlameMeter {have} {quorum} state={fstate === "gone" ? "ember" : fstate} />
    <div class="row">
      <Button full={false} haptic="tap" onclick={yes} disabled={fstate !== "kindling"}>Yes +1</Button>
      <Button full={false} variant="secondary" onclick={toEmber}>Ember</Button>
      <Button full={false} variant="secondary" onclick={toGone}>Gone</Button>
      <Button full={false} variant="text" onclick={reset}>Reset</Button>
    </div>
  </section>

  <section class="card" aria-labelledby="h-photo">
    <h2 class="t-heading" id="h-photo">The photo develops, then six words</h2>
    {#key develop}
      <PhotoPrint state={develop ? "developing" : "developed"} scene="A pond with yellow trees and an empty bench." height={240} />
      <TypeWords text="Pond bench, golden hour. Come sit?" play={develop > 0} delay={1440} />
    {/key}
    <Button full={false} variant="secondary" onclick={() => (develop += 1)}>Develop again</Button>
  </section>

  <section class="card" data-sun aria-labelledby="h-compass">
    <h2 class="t-heading" id="h-compass">The compass locks on</h2>
    <Compass {bearing} {meters} cues {speak} />
    <label class="slider">Bearing {bearing}°
      <input type="range" min="-180" max="180" bind:value={bearing} />
    </label>
    <label class="slider">Distance {meters} m
      <input type="range" min="20" max="800" step="10" bind:value={meters} />
    </label>
    <label class="switch-row"><input type="checkbox" bind:checked={speak} /> <span>Speak</span></label>
  </section>

  <section class="card" aria-labelledby="h-sheet">
    <h2 class="t-heading" id="h-sheet">Sheet and buttons</h2>
    <div class="row">
      <Button full={false} onclick={() => (sheet = true)}>Open sheet</Button>
      <Button full={false} variant="secondary">Press me</Button>
    </div>
    <p class="t-small t-muted">Drag the sheet's handle down to close it, or press Escape.</p>
    <a class="link" href="/lab/fps/">Page transition: go to the frame-rate lab</a>
  </section>
</main>

<Sheet bind:open={sheet} title="A sheet" description="It rises in 260 ms and leaves in 160 ms.">
  <Button onclick={() => (sheet = false)}>Close</Button>
</Sheet>

<style>
  .lab { max-width: 640px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; background: var(--bg); min-height: 100vh; }
  .card { background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip { min-height: 44px; min-width: 44px; border-radius: var(--r-pill); border: 2px solid var(--text); background: transparent; font-weight: 700; }
  .chip[aria-pressed="true"] { background: var(--accent-bg); color: var(--on-accent); border-color: var(--accent-bg); }
  .switch-row { display: flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 700; }
  .switch-row input { width: 26px; height: 26px; }
  .slider { display: flex; flex-direction: column; gap: 4px; font-weight: 700; }
  .slider input { min-height: 44px; }
  .link { color: var(--accent-text); font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; }
</style>
