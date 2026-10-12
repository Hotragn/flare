<!-- Cold start on Render's free tier (ADR-0005 amended): after 4 s on a request, a calm full
     screen, the outdoor scene and a breathing flame, instead of a spinner. Clears itself. -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import Flame from "./Flame.svelte";
  import SceneryLater from "./SceneryLater.svelte";
</script>

<div class="waking" role="status" aria-live="polite">
  <div class="art" aria-hidden="true"><SceneryLater /></div>
  <div class="veil" aria-hidden="true"></div>
  <div class="msg">
    <span class="flame"><Flame state="kindling" progress={0.6} size={90} /></span>
    <p>{t("app.waking")}</p>
  </div>
</div>

<style>
  .waking { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; color: #fff; }
  .art, .veil { position: absolute; inset: 0; }
  .art :global(svg) { width: 100%; height: 100%; display: block; }
  .veil { background: linear-gradient(to bottom, rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.65)); }
  .msg { position: relative; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 0 32px; text-align: center; }
  .msg p { margin: 0; font-weight: 700; font-size: calc(1.25rem * var(--text-scale)); text-shadow: 0 1px 10px rgb(0 0 0 / 0.5); }
  .flame { animation: breathe 2.4s ease-in-out infinite; }
  @keyframes breathe { 50% { transform: scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .flame { animation: none; } }
</style>
