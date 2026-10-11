<script lang="ts">
  // Zod must run jitless before any schema parses (BUG-029); keep this import first.
  import "#lib/zod-csp.ts";
  import "#lib/styles/app.css";
  import { onMount } from "svelte";
  import { onNavigate } from "$app/navigation";
  import { pageTransition } from "#lib/motion/transitions.ts";
  import { installAudioStart } from "#lib/motion/sound.ts";
  let { children } = $props();

  // Page transitions (docs/design/motion.md 3.10): View Transitions where they exist, else an instant swap.
  onNavigate((navigation) => pageTransition(() => navigation.complete));

  onMount(() => {
    // Sound waits for the first tap or key (iOS starts audio only from a gesture).
    installAudioStart();
    try {
      if (localStorage.getItem("flare.motion") === "reduce") document.documentElement.setAttribute("data-reduce-motion", "");
    } catch {
      // Storage blocked (private mode): the system Reduce Motion setting still applies.
    }
  });
</script>

{@render children()}
