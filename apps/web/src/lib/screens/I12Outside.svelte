<!--
  I12 Go outside: the end of every flow points outside, not to more app.
  view "end" follows Done: "You were outside 52 min together" when this phone knows when you
  arrived (2026 direction, B), else "Thanks for coming." Then a calm "Phone away" screen.
  view "go" follows I8.
  The end of a Flare: the ember cools, ash drifts up, and the minutes outside together count up
  (about 1.1 s; the full line is the screen's heading for screen readers from the start).
-->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Flame from "../components/Flame.svelte";
  import Hearth from "../components/Hearth.svelte";
  import { onMount } from "svelte";
  import { reducedMotion } from "#lib/motion/core.ts";
  import FlameAvatars from "../components/FlameAvatars.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "end",
    theme = "light",
    spot = "",
    sunset = "",
    minutes = null,
    photo = "",
    people = [],
    spark = "",
    onclose,
  }: {
    view?: "end" | "go";
    theme?: Theme;
    spot?: string;
    sunset?: string;
    minutes?: number | null;
    /** The Flare's own photo behind the summary; the outdoor scenery when there is none. */
    photo?: string;
    /** Who came, as names this phone already knows (no profiles). */
    people?: string[];
    /** The Spark just left, if any. */
    spark?: string;
    onclose?: () => void;
  } = $props();
  let away = $state(false);
  const together = (m: number) => (m >= 60 ? t("motion.outsideH", { h: Math.floor(m / 60), m: m % 60 }) : t("outside.together", { min: m }));
  const headline = $derived(view === "go" && spot ? t("outside.go", { spot }) : minutes ? together(minutes) : t("outside.thanks"));
  // The count-up: from 0 to the minutes, easing out, once.
  let counted = $state<number | null>(null);
  let el: HTMLElement | undefined = $state();
  onMount(() => {
    const total = minutes ?? 0;
    if (view !== "end" || total < 2 || reducedMotion(el)) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1100);
      counted = Math.round(total * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
      else counted = null;
    };
    counted = 0;
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
  const shown = $derived(counted !== null && view === "end" ? together(Math.max(1, counted)) : headline);
</script>

{#if away}
  <Screen theme="dark" close={false} heading={t("outside.away")}>
    <div class="away">
      <Flame state="lit" size={120} />
      <p class="t-display">{t("outside.away")}</p>
      <p class="t-muted">{t("outside.awayBody")}</p>
    </div>
    {#snippet actions()}<Button variant="secondary" onclick={onclose}>{t("gone.close")}</Button>{/snippet}
  </Screen>
{:else}
  <Screen stage backdrop={photo} fallbackArt close={false} heading={headline}>
    {#snippet hero()}
      <div class="msg" bind:this={el}>
        {#if view === "end"}<div class="cool"><Hearth state="gone" size={104} cool horizon={false} /></div>{/if}
        {#if people.length}<FlameAvatars people={people.map((name) => ({ name, out: true }))} />{:else if view !== "end"}<Flame state="lit" size={96} />{/if}
        <p class="t-display big" aria-hidden="true">{shown}</p>
        {#if spark}<p class="spark"><Icon name="spark" size={20} /><span>{t("invite.sparkQuote", { line: spark })}</span></p>{/if}
      </div>
    {/snippet}
    {#if sunset}<p class="t-muted">{t("outside.quiet", { sunset })}</p>{/if}
    {#snippet actions()}
      <Button onclick={() => (away = true)}>{t("outside.awayCta")}</Button>
    {/snippet}
  </Screen>
{/if}

<style>
  .msg { display: flex; flex-direction: column; gap: 10px; }
  .msg p { margin: 0; }
  .big { font-variant-numeric: tabular-nums; }
  .cool { width: 120px; margin-left: -18px; }
  .spark { display: flex; gap: 8px; align-items: center; font-weight: 700; font-size: calc(1.125rem * var(--text-scale)); color: var(--c-gold-400); }
  .away { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
  .away p { margin: 0; }
  .away :global(svg) { animation: breathe 6s ease-in-out infinite; }
  @keyframes breathe { 50% { opacity: 0.7; transform: scale(0.96); } }
  @media (prefers-reduced-motion: reduce) { .away :global(svg) { animation: none; } }
</style>
