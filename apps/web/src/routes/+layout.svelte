<script lang="ts">
  // Zod must run jitless before any schema parses (BUG-029); keep this import first.
  import "#lib/zod-csp.ts";
  import "#lib/styles/app.css";
  import { onMount } from "svelte";
  import { beforeNavigate, onNavigate } from "$app/navigation";
  import { followNewVersion } from "#lib/push/update.ts";
  import { pageTransition } from "#lib/motion/transitions.ts";
  import { installAudioStart } from "#lib/motion/sound.ts";
  let { children } = $props();

  // Page transitions (docs/design/motion.md 3.10): View Transitions where they exist, else an instant swap.
  onNavigate((navigation) => pageTransition(() => navigation.complete));

  // Live bug 6: once a newer version controls this page, the next link is a full page load.
  let fresh: { shouldReload: () => boolean } | null = null;
  beforeNavigate((nav) => {
    if (!fresh?.shouldReload() || !nav.to?.url || nav.willUnload) return;
    nav.cancel();
    location.href = nav.to.url.href;
  });

  onMount(() => {
    // Sound waits for the first tap or key (iOS starts audio only from a gesture).
    installAudioStart();
    fresh = followNewVersion();
    try {
      if (localStorage.getItem("flare.motion") === "reduce") document.documentElement.setAttribute("data-reduce-motion", "");
    } catch {
      // Storage blocked (private mode): the system Reduce Motion setting still applies.
    }
  });
</script>

{@render children()}
