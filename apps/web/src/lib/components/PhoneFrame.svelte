<!-- Full-height frame for the app screens (/app/, /g/): one screen fills the viewport, the action area stays in the thumb zone; on wide screens it centres at the phone width. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import DeskNote from "./DeskNote.svelte";
  let { children }: { children: Snippet } = $props();
</script>

<div class="phone">{@render children()}</div>
<DeskNote />

<style>
  /* translateZ makes this the box that position: fixed screens fill, so on a desktop the
     onboarding, demo and sheets stay in the phone-width column too (fresh-eyes #19). */
  .phone { position: relative; transform: translateZ(0); height: 100vh; height: 100dvh; max-width: var(--l-max-width, 480px); margin: 0 auto; overflow: hidden; background: var(--bg); }
  :global(html:has(.phone)), :global(body:has(.phone)) { background: var(--bg); overscroll-behavior: none; }
  @media (min-width: 1000px) { :global(body:has(.phone)) { background: #1b2a1f; } }
</style>
