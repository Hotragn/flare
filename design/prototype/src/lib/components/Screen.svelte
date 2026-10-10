<!--
  Phone screen layout. Content scrolls; the action area is pinned in the thumb zone.
  theme: light | dark | sun. Use sun for any screen used outside (brand sun mode).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import { themeAttrs, type Theme } from "./parts";

  let {
    theme = "light",
    title = "",
    heading = "",
    close = true,
    menu = false,
    offline = "",
    grain = true,
    tone = "bg",
    onclose,
    onmenu,
    children,
    actions,
    overlay,
    wire = false,
  }: {
    theme?: Theme; title?: string; heading?: string; close?: boolean; menu?: boolean; offline?: string; grain?: boolean;
    tone?: "bg" | "dusk"; onclose?: () => void; onmenu?: () => void; children: Snippet; actions?: Snippet; overlay?: Snippet; wire?: boolean;
  } = $props();
</script>

<div class="screen" class:grain class:dusk={tone === "dusk"} {...themeAttrs(theme)} data-wire={wire || undefined}>
  <header class="bar">
    {#if menu}
      <button class="icon-btn" aria-label="Menu" onclick={onmenu}><Icon name="menu" /></button>
    {:else}<span class="spacer"></span>{/if}
    {#if title}<span class="bar-title t-small">{title}</span>{/if}
    {#if close}
      <button class="icon-btn" aria-label="Close" onclick={onclose}><Icon name="close" /></button>
    {:else}<span class="spacer"></span>{/if}
  </header>
  {#if offline}
    <div class="offline" role="status"><Icon name="offline" size={20} /><span>{offline}</span></div>
  {/if}
  <!-- tabindex lets keyboard users scroll long content (WCAG 2.1.1, axe scrollable-region-focusable) -->
  <main class="content" tabindex="0">
    {#if heading}<h1 class="visually-hidden">{heading}</h1>{/if}
    {@render children()}
  </main>
  {#if actions}
    <footer class="actions">{@render actions()}</footer>
  {/if}
  {#if overlay}{@render overlay()}{/if}
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
  .icon-btn { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--text) 7%, transparent); color: var(--text); }
  .icon-btn:active { transform: scale(0.94); }
  .offline { margin: 4px 20px 0; padding: 10px 14px; border-radius: var(--r-md); display: flex; gap: 8px; align-items: center; background: var(--surface); border: 2px solid var(--line); font-weight: 700; font-size: calc(var(--t-small-size) * var(--text-scale)); }
  .content:focus-visible { outline-offset: -4px; }
  .content { flex: 1; overflow-y: auto; padding: 8px var(--l-gutter) 16px; display: flex; flex-direction: column; gap: 18px; }
  .actions { padding: 12px var(--l-gutter) 24px; display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
</style>
