<script lang="ts">
  import "#lib/styles/app.css";
  import { onMount } from "svelte";
  import { onNavigate } from "$app/navigation";
  import { pageTransition } from "#lib/motion/transitions.ts";
  import { installAudioUnlock } from "#lib/motion/sound.ts";
  let { children } = $props();

  // Page transitions (docs/design/motion.md 3.10): View Transitions API where it exists
  // (Chrome 111+, Safari 18+); a plain instant swap everywhere else.
  onNavigate((navigation) => pageTransition(() => navigation.complete));

  onMount(() => {
    // Sound waits for the first tap or key (iOS audio unlock; no autoplay).
    installAudioUnlock();
    // In-app "Reduce motion" setting, remembered on this phone.
    try { if (localStorage.getItem("flare.motion") === "reduce") document.documentElement.setAttribute("data-reduce-motion", ""); } catch { /* ignore */ }
  });
</script>

{@render children()}
