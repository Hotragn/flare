<!--
  FlameMeter: the live flame and the count, together. The flame grows with each
  yes (Kindling), catches (Lit), or settles (Ember). This is the screenshot moment.
  Count only, never names (SRS-RES-4).
-->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import { untrack } from "svelte";
  import Flame from "./Flame.svelte";
  import { kindlingProgress } from "#lib/motion/core.ts";
  import type { FlameState } from "../brand";
  let { have = 1, quorum = 2, state: st = "kindling", size = 132, note = "" }: { have?: number; quorum?: number; state?: FlameState; size?: number; note?: string } = $props();
  const need = $derived(Math.max(0, quorum - have));
  // Same step table as the big flame (motion.md 3.1); the meter starts at 72.5% so it reads at 124 px.
  const progress = $derived(kindlingProgress(have, quorum));
  // Count tick: after mount, each change of the count rises in on the spring (260 ms)
  // and the newest filled dot pops. Nothing moves on first paint.
  let ticked = $state(false);
  let lastHave = untrack(() => have);
  $effect(() => { if (have !== lastHave) ticked = true; lastHave = have; });
  const line = $derived(st === "lit" ? t("need.lit") : need === 0 ? t("need.catching") : t("need.more", { n: need }));
</script>

<div class="meter {st}" role="status" aria-live="polite">
  <div class="fire" aria-hidden="true">
    <span class="glow" style:--p={st === "lit" ? 1 : progress}></span>
    <span class="base"></span>
    <div class="flame"><Flame state={st} progress={0.5 + progress * 0.5} size={Math.min(size, 124)} /></div>
  </div>
  <div class="text">
    {#key line}<p class="t-heading count" class:tick={ticked}>{line}</p>{/key}
    <p class="dots" aria-hidden="true">
      {#each Array(Math.max(quorum, have)) as _, i}<span class:in={i < have} class:pop={ticked && i === have - 1}></span>{/each}
    </p>
    <p class="t-small t-muted">{note || t("need.detail", { n: have, q: quorum })}</p>
  </div>
</div>

<style>
  .meter { display: flex; align-items: center; gap: 14px; padding: 12px 16px 12px 6px; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--e-2); border: 1px solid var(--line); }
  .fire { position: relative; width: 112px; height: 124px; flex: none; display: grid; place-items: end center; }
  .flame { position: relative; margin-bottom: 6px; }
  .glow { position: absolute; bottom: 4px; left: 50%; width: 120px; height: 60px; transform: translateX(-50%) scale(calc(0.5 + var(--p) * 0.6)); border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--c-gold-400) 60%, transparent), transparent); transition: transform var(--dur-slow) var(--ease-spring); }
  .base { position: absolute; bottom: 6px; left: 50%; width: 54px; height: 9px; transform: translateX(-50%); border-radius: 50%; background: color-mix(in srgb, var(--c-ink-900) 22%, transparent); }
  .ember .glow { background: radial-gradient(closest-side, color-mix(in srgb, var(--c-maple-600) 45%, transparent), transparent); }
  .text { display: flex; flex-direction: column; gap: 4px; }
  .text p { margin: 0; }
  .dots { display: flex; gap: 6px; }
  .dots span { width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--text); }
  .dots span.in { background: var(--lit); border-color: var(--lit); transition: background var(--dur-quick), border-color var(--dur-quick); }
  .tick { animation: tick var(--dur-base) var(--ease-spring) both; }
  .pop { animation: pop var(--dur-base) var(--ease-spring) both; }
  @keyframes tick { from { transform: translateY(0.45em); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes pop { from { transform: scale(0.5); } to { transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { .tick { animation: fade var(--dur-fade) linear both; } .pop { animation: none; } }
  :global([data-reduce-motion]) .tick { animation: fade var(--dur-fade) linear both; }
  :global([data-reduce-motion]) .pop { animation: none; }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
</style>
