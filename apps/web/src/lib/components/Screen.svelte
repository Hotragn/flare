<!--
  Phone screen layout. Content scrolls; the action area is pinned in the thumb zone.
  theme: light | dark | sun. Use sun for any screen used outside (brand sun mode).
-->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import SoundToggle from "./SoundToggle.svelte";
  import { themeAttrs, type Theme } from "./parts";
  import { net } from "#lib/net/waking.svelte.ts";
  import Waking from "./Waking.svelte";
  import Scenery from "./Scenery.svelte";

  let {
    theme = "light",
    title = "",
    heading = "",
    sound = false,
    close = true,
    menu = false,
    offline = "",
    grain = false, // 2026 direction: no paper grain in the app
    tone = "bg",
    onclose,
    onmenu,
    children,
    actions,
    overlay,
    wire = false,
    stage = false,
    backdrop = "",
    backdropAlt = "",
    hero,
    backdropArt,
    fallbackArt = false,
    sky = undefined,
  }: {
    theme?: Theme; title?: string; heading?: string; sound?: boolean; close?: boolean; menu?: boolean; offline?: string; grain?: boolean;
    tone?: "bg" | "dusk"; onclose?: () => void; onmenu?: () => void; children: Snippet; actions?: Snippet; overlay?: Snippet; wire?: boolean;
    /** 2026 direction: the photo is the screen. Full-bleed backdrop, content on a glass sheet. */
    stage?: boolean; backdrop?: string; backdropAlt?: string; hero?: Snippet;
    /** Illustration behind the stage when there's no photo (Home uses the outdoor scenery). */
    backdropArt?: Snippet;
    /** No photo (typed words): show the outdoor scenery rather than a bare gradient. */
    fallbackArt?: boolean;
    /** The weather and clock for the illustrated scene (#lib/motion/sky.ts); the phone's clock when absent. */
    sky?: import("#lib/motion/sky.ts").SkyInput;
  } = $props();
  const staged = $derived(stage || !!backdrop);
</script>

<div class="screen" class:grain class:dusk={tone === "dusk"} class:staged {...themeAttrs(staged ? "dark" : theme)} data-wire={wire || undefined}>
  {#if staged}
    <!-- The photo is content (its alt is the scene for friends who can't see it), so it sits in a
         labelled region, not loose outside every landmark (page audit, axe region). -->
    {#if backdrop}<section class="lm" aria-label={backdropAlt || heading || title}><img class="backdrop" src={backdrop} alt={backdropAlt} /></section>{:else if backdropArt}<div class="backdrop art" aria-hidden="true">{@render backdropArt()}</div>{:else if fallbackArt}<div class="backdrop art" aria-hidden="true"><Scenery {sky} /></div>{:else}<div class="backdrop warm" aria-hidden="true"></div>{/if}
    <div class="scrim" aria-hidden="true"></div>
  {/if}
  <header class="bar">
    {#if menu}
      <button class="icon-btn" aria-label={t("app.menu")} onclick={onmenu}><Icon name="menu" /></button>
    {:else}<span class="spacer"></span>{/if}
    {#if title}<span class="bar-title t-small">{title}</span>{/if}
    <span class="right">{#if sound}<SoundToggle />{/if}
    {#if close}
      <button class="icon-btn" aria-label={t("app.close")} onclick={onclose}><Icon name="close" /></button>
    {:else}<span class="spacer"></span>{/if}</span>
  </header>
  {#if offline}
    <div class="offline" role="status"><Icon name="offline" size={20} /><span>{offline}</span></div>
  {/if}
  <!-- tabindex lets keyboard users scroll long content (WCAG 2.1.1, axe scrollable-region-focusable) -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  {#if staged}
    <section class="hero" aria-label={heading || title || t("app.name")}>{#if hero}{@render hero()}{/if}</section>
    <section class="sheet">
      <span class="grab" aria-hidden="true"></span>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <main class="content" tabindex="0">
        {#if heading}<h1 class="visually-hidden">{heading}</h1>{/if}
        {@render children()}
      </main>
      {#if actions}<footer class="actions">{@render actions()}</footer>{/if}
    </section>
  {:else}
  <main class="content" tabindex="0">
    {#if heading}<h1 class="visually-hidden">{heading}</h1>{/if}
    {@render children()}
  </main>
  {#if actions}
    <footer class="actions">{@render actions()}</footer>
  {/if}
  {/if}
  {#if overlay}{@render overlay()}{/if}
  {#if net.slow > 0 && !offline}<Waking />{/if}
</div>

<style>
  .screen {
    width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg); color: var(--text);
    padding: env(safe-area-inset-top, 0) 0 env(safe-area-inset-bottom, 0); overflow: hidden; position: relative;
  }
  .dusk { background: var(--c-dusk-900); }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 0; min-height: 56px; }
  .bar-title { color: var(--text-muted); font-weight: 700; }
  .spacer { width: 44px; }
  .right { display: inline-flex; gap: 6px; align-items: center; }
  .icon-btn { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--text) 7%, transparent); color: var(--text); }
  .icon-btn:active { transform: scale(0.94); }
  .offline { margin: 4px 20px 0; padding: 10px 14px; border-radius: var(--r-md); display: flex; gap: 8px; align-items: center; background: var(--surface); border: 2px solid var(--line); font-weight: 700; font-size: calc(var(--t-small-size) * var(--text-scale)); }
  .content:focus-visible { outline-offset: -4px; }
  .content { flex: 1; overflow-y: auto; padding: 8px var(--l-gutter) 16px; display: flex; flex-direction: column; gap: 18px; }
  .actions { padding: 12px var(--l-gutter) 24px; display: flex; flex-direction: column; gap: 6px; align-items: stretch; }

  /* Stage: the photo is the screen (docs/design/09-2026-direction.md, rules 1, 6). */
  /* While the photo decrypts (about 1.5 s), the warm light shows, never a black screen. */
  .staged { background: radial-gradient(120% 80% at 50% 30%, var(--c-maple-600) 0%, var(--c-ember-700) 45%, #120806 100%); }
  .backdrop { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
  .backdrop.art :global(svg), .backdrop.art :global(.scenery) { width: 100%; height: 100%; display: block; }
  .backdrop.art :global(svg) { object-fit: cover; }
  .backdrop.warm { background: radial-gradient(120% 80% at 50% 30%, var(--c-maple-600) 0%, var(--c-ember-700) 45%, #120806 100%); }
  /* Top scrim for the bar buttons, bottom scrim behind the sheet: text stays at 4.5:1 on any photo. */
  .scrim { position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: linear-gradient(to bottom, rgb(0 0 0 / 0.45) 0%, rgb(0 0 0 / 0) 22%, rgb(0 0 0 / 0) 40%, rgb(0 0 0 / 0.55) 70%, rgb(0 0 0 / 0.8) 100%); }
  .staged > .bar, .staged > .offline, .staged > .hero, .staged > .sheet { position: relative; z-index: 1; }
  .lm { display: contents; }
  .staged .icon-btn { background: rgb(255 255 255 / 0.18); color: #fff; backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4); }
  .staged .bar-title { color: rgb(255 255 255 / 0.9); }
  .hero { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 var(--l-gutter) 16px; color: #fff; text-shadow: 0 1px 12px rgb(0 0 0 / 0.5); min-height: 0; }
  .sheet { width: 100%; align-self: stretch; box-sizing: border-box; max-height: 62%; display: flex; flex-direction: column; border-radius: 28px 28px 0 0; color: #fff;
    background: rgb(18 16 16 / 0.74); backdrop-filter: blur(28px) saturate(1.6); -webkit-backdrop-filter: blur(28px) saturate(1.6);
    box-shadow: 0 -1px 0 rgb(255 255 255 / 0.12) inset; margin-bottom: calc(-1 * env(safe-area-inset-bottom, 0)); padding-bottom: env(safe-area-inset-bottom, 0); }
  .sheet .content { padding-top: 4px; gap: 12px; }
  /* Cards inside the sheet sit flat on the glass: no second box (rule 6). */
  .staged .sheet :global(.meter) { background: transparent; border: 0; box-shadow: none; padding-left: 0; }
  .staged .sheet :global(.opt) { background: rgb(255 255 255 / 0.12); border-color: transparent; color: #fff; }
  .staged .sheet :global(.opt.on) { background: #fff; color: #111; border-color: #fff; }
  /* The field's box carries the glass fill; the input inside stays clear, so there is one box,
     not a box in a box (fresh-eyes round 2). */
  .staged .sheet :global(.box) { background: rgb(255 255 255 / 0.1); border-color: rgb(255 255 255 / 0.45); }
  .staged .sheet :global(input:not([type="radio"]):not([type="checkbox"])), .staged .sheet :global(textarea) { background: transparent; color: #fff; }
  /* Muted text over a photo needs more light to stay at 4.5:1. */
  .staged .hero :global(.t-muted), .staged .sheet :global(.t-muted) { color: rgb(255 255 255 / 0.86); }
  .grab { width: 36px; height: 5px; border-radius: 3px; background: rgb(255 255 255 / 0.35); margin: 8px auto 4px; flex: none; }
</style>
