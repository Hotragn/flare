<!-- Full-height frame for the app screens (/app/, /g/): one screen fills the viewport, the action area stays in the thumb zone; on wide screens it centres at the phone width. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  let { children }: { children: Snippet } = $props();
</script>

<div class="phone">{@render children()}</div>

<style>
  .phone { height: 100vh; height: 100dvh; max-width: var(--l-max-width, 480px); margin: 0 auto; overflow: hidden; background: var(--bg); }
  :global(html:has(.phone)), :global(body:has(.phone)) { background: var(--bg); overscroll-behavior: none; }
</style>
