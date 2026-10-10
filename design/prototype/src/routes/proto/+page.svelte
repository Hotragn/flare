<!--
  Clickable prototype of the key moments. Tap the main button (or the shutter) on
  the phone to move on; some steps move on by themselves when a "friend" answers.
  Friends are simulated here; nothing is sent anywhere.
-->
<script lang="ts">
  import { byId } from "#lib/screens/registry.ts";
  import type { Theme } from "#lib/components/parts.ts";
  import { tick } from "svelte";
  import { stepTransition } from "#lib/motion/transitions.ts";
  import { feedback, type Moment } from "#lib/motion/feedback.ts";
  import { hapticTap } from "#lib/motion/haptics.ts";
  import { isMuted, setMuted } from "#lib/motion/sound.ts";

  type Step = { id: string; view: string; theme: Theme; note: string; auto?: number };
  const moments: { name: string; steps: Step[] }[] = [
    { name: "Send a Flare", steps: [
      { id: "H1", view: "live", theme: "light", note: "Open Flare. The camera is already on. Tap the shutter." },
      { id: "H2", view: "developing", theme: "light", note: "The print develops while our laptop writes six words (about 3 s).", auto: 2800 },
      { id: "H2", view: "drafted", theme: "light", note: "Six words arrive one by one. Use them, or write your own." },
      { id: "H3", view: "ready", theme: "light", note: "One setting: how many make it go. Send it." },
      { id: "H4", view: "success", theme: "light", note: "Sent. The share sheet opens; the phone goes back in your pocket." },
    ] },
    { name: "Say yes, with a condition", steps: [
      { id: "I1", view: "kindling", theme: "light", note: "Amor opens the link. One private button. Tap 'Add a condition' or 'I'm in'." },
      { id: "I2", view: "typing", theme: "light", note: "In her own words. The text never leaves her phone." },
      { id: "I3", view: "flare", theme: "light", note: "Read back in one sentence. Only the rule is sent." },
      { id: "I4", view: "success", theme: "light", note: "You're in. The flame grows a notch. Pocket it." },
    ] },
    { name: "It lights", steps: [
      { id: "H5", view: "growing", theme: "sun", note: "Fuego's flame grows with each yes. No names, just the count.", auto: 2600 },
      { id: "I6", view: "lit", theme: "sun", note: "Simulated: Shilp says yes. It catches. Sparks, a sound, one buzz." },
    ] },
    { name: "Find your friend", steps: [
      { id: "I7", view: "pointing", theme: "sun", note: "The pin-flame points to Fuego and speaks. Rings tighten as you get close.", auto: 3000 },
      { id: "I7", view: "facing", theme: "sun", note: "Facing them: the flame lights and the phone ticks. 'I'm here'." },
      { id: "I8", view: "success", theme: "sun", note: "You made it. Look up." },
    ] },
    { name: "Shrinks to an Ember", steps: [
      { id: "H5", view: "zero", theme: "sun", note: "Nobody's free yet. At 30 min it doesn't die; it shrinks.", auto: 2600 },
      { id: "I9", view: "waiting", theme: "sun", note: "Smaller plan: 15 min at the bench. One friend is enough." },
      { id: "I9", view: "lit", theme: "sun", note: "Ammo says yes. It's lit, smaller. Counts as an Ember save." },
    ] },
    { name: "Answer a Plan", steps: [
      { id: "P4", view: "open", theme: "light", note: "'Fairlane walk at 11?' Four sizes, biggest first. Try 'Short one only'." },
      { id: "I3", view: "plan", theme: "light", note: "Step 3 or smaller, back by 5. Right?" },
      { id: "P5", view: "step-1", theme: "sun", note: "At 10:40 the solver picks the biggest group at the biggest step." },
      { id: "P6", view: "confirm", theme: "sun", note: "Tired? 'I'm fading' makes it one step smaller. Nobody sees who." },
      { id: "P5", view: "smaller", theme: "sun", note: "Everyone sees only 'Smaller plan'." },
    ] },
    { name: "Leave a Spark", steps: [
      { id: "I11", view: "typing", theme: "light", note: "After Done: one line, your words only. Optional, once." },
      { id: "I11", view: "saved", theme: "light", note: "It shows next time the group meets here." },
      { id: "I12", view: "end", theme: "light", note: "The last screen points outside." },
    ] },
  ];

  let m = $state(0);
  let s = $state(0);
  const step = $derived(moments[m].steps[s]);
  const entry = $derived(byId(step.id));

  // Motion and sound hooks (docs/design/motion.md 3): each step change runs in a view
  // transition; arriving on a moment plays its sound and haptic.
  const cue: Record<string, Moment> = { "I4 success": "yes", "I6 lit": "lit", "I7 facing": "facing", "I9 waiting": "ember", "I9 lit": "lit", "P5 step-1": "lit" };
  let sound = $state(true);
  function go(update: () => void) { stepTransition(update); }
  function next() {
    go(() => {
      if (s < moments[m].steps.length - 1) s += 1;
      else if (m < moments.length - 1) { m += 1; s = 0; }
    });
  }
  function prev() {
    go(() => {
      if (s > 0) s -= 1;
      else if (m > 0) { m -= 1; s = moments[m].steps.length - 1; }
    });
  }
  function onPhoneClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest(".btn.primary, .shutter, .btn.text, .btn.secondary")) next();
  }
  $effect(() => { sound = !isMuted(); });
  $effect(() => {
    const k = `${step.id} ${step.view}`;
    if (cue[k]) feedback(cue[k], { hapticAttached: true });
  });
  // The yes button ticks on the user's own tap (iOS switch overlay, or vibrate on Android).
  let phone: HTMLDivElement | undefined = $state();
  $effect(() => {
    const id = step.id;
    let undo: { destroy: () => void } | undefined;
    let alive = true;
    tick().then(() => setTimeout(() => {
      const b = phone?.querySelector<HTMLElement>(".btn.primary");
      if (alive && b && id === "I1") undo = hapticTap(b, "tap");
    }, 50));
    return () => { alive = false; undo?.destroy(); };
  });
  $effect(() => {
    const ms = step.auto;
    if (!ms) return;
    const id = setTimeout(next, ms);
    return () => clearTimeout(id);
  });
</script>

<svelte:head><title>Flare prototype</title></svelte:head>

<div class="wrap" data-theme="light">
  <aside class="side">
    <p class="label">Flare · clickable prototype</p>
    <h1 class="t-title">Key moments</h1>
    <ol class="moments">
      {#each moments as mo, i}
        <li><button class:active={i === m} onclick={() => go(() => { m = i; s = 0; })}>{i + 1}. {mo.name}</button></li>
      {/each}
    </ol>
    <p class="note" aria-live="polite">{step.note}</p>
    <div class="nav">
      <button onclick={prev} disabled={m === 0 && s === 0}>Back</button>
      <span>{s + 1} / {moments[m].steps.length}</span>
      <button onclick={next}>Next</button>
    </div>
    <button class="sound" aria-pressed={sound} onclick={() => { sound = !sound; setMuted(!sound); }}>Sound {sound ? "on" : "off"}</button>
    <p class="small">Friends are simulated. Tap the main button on the phone to move on. {step.id} · {step.view} · {step.theme}</p>
  </aside>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="phone" onclick={onPhoneClick} bind:this={phone}>
    {#key `${m}-${s}`}
      {#await entry!.load() then mod}
        <mod.default view={step.view} theme={step.theme} />
      {/await}
    {/key}
  </div>
</div>

<style>
  .wrap { min-height: 100vh; display: flex; gap: 40px; align-items: center; justify-content: center; padding: 24px; background: var(--c-birch-200); flex-wrap: wrap; }
  .side { max-width: 340px; display: flex; flex-direction: column; gap: 12px; }
  .label { margin: 0; font-weight: 700; color: var(--accent-text); }
  h1 { margin: 0; }
  .moments { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .moments button { width: 100%; text-align: left; min-height: 44px; padding: 0 12px; border-radius: var(--r-md); border: 0; background: transparent; font-weight: 700; }
  .moments button.active { background: var(--c-birch-50); box-shadow: var(--e-1); }
  .note { margin: 0; min-height: 4.5em; font-size: 1.05rem; }
  .nav { display: flex; align-items: center; gap: 12px; }
  .nav button { min-height: 44px; padding: 0 18px; border-radius: var(--r-pill); border: 2px solid var(--c-ink-900); background: transparent; font-weight: 700; }
  .sound { align-self: flex-start; min-height: 44px; padding: 0 18px; border-radius: var(--r-pill); border: 2px solid var(--c-ink-900); background: transparent; font-weight: 700; }
  .small { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
  .phone { width: 390px; height: 844px; border-radius: 48px; overflow: hidden; position: relative; box-shadow: 0 0 0 10px var(--c-ink-900), var(--e-3); transform: translateZ(0); view-transition-name: vt-phone; }
  @media (max-width: 860px) { .phone { width: 100%; max-width: 390px; border-radius: 0; box-shadow: none; } .wrap { padding: 0; gap: 12px; } .side { padding: 16px; } }
</style>
