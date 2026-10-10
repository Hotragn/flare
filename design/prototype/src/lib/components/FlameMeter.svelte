<!--
  FlameMeter: the live flame and the count, together. The flame grows with each
  yes (Kindling), catches (Lit), or settles (Ember). This is the screenshot moment.
  Count only, never names (SRS-RES-4).
-->
<script lang="ts">
  import Flame from "./Flame.svelte";
  import type { FlameState } from "../brand";
  let { have = 1, quorum = 2, state = "kindling", size = 132, note = "" }: { have?: number; quorum?: number; state?: FlameState; size?: number; note?: string } = $props();
  const need = $derived(Math.max(0, quorum - have));
  const progress = $derived(quorum > 1 ? (have - 1) / (quorum - 1) : 1);
  const line = $derived(state === "lit" ? "It's lit." : need === 0 ? "Catching…" : `Need ${need} more.`);
</script>

<div class="meter {state}" role="status" aria-live="polite">
  <div class="fire" aria-hidden="true">
    <span class="glow" style:--p={state === "lit" ? 1 : progress}></span>
    <span class="base"></span>
    <div class="flame"><Flame {state} progress={0.5 + progress * 0.5} {size} /></div>
  </div>
  <div class="text">
    <p class="t-heading count">{line}</p>
    <p class="dots" aria-hidden="true">
      {#each Array(Math.max(quorum, have)) as _, i}<span class:in={i < have}></span>{/each}
    </p>
    <p class="t-small t-muted">{note || `${have} in, ${quorum} to go ahead. Nobody sees who.`}</p>
  </div>
</div>

<style>
  .meter { display: flex; align-items: center; gap: 14px; padding: 12px 16px 12px 6px; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--e-2); border: 1px solid var(--line); }
  .fire { position: relative; width: 112px; height: 124px; flex: none; display: grid; place-items: end center; }
  .flame { position: relative; margin-bottom: 6px; }
  .flame :global(svg) { width: 124px; height: 124px; }
  .glow { position: absolute; bottom: 4px; left: 50%; width: 120px; height: 60px; transform: translateX(-50%) scale(calc(0.5 + var(--p) * 0.6)); border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--c-gold-400) 60%, transparent), transparent); transition: transform var(--dur-slow) var(--ease-spring); }
  .base { position: absolute; bottom: 6px; left: 50%; width: 54px; height: 9px; transform: translateX(-50%); border-radius: 50%; background: color-mix(in srgb, var(--c-ink-900) 22%, transparent); }
  .ember .glow { background: radial-gradient(closest-side, color-mix(in srgb, var(--c-maple-600) 45%, transparent), transparent); }
  .text { display: flex; flex-direction: column; gap: 4px; }
  .text p { margin: 0; }
  .dots { display: flex; gap: 6px; }
  .dots span { width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--text); }
  .dots span.in { background: var(--lit); border-color: var(--lit); }
</style>
