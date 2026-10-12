<!-- Loads a section that only works with JavaScript (the photo try, the live strip) when it comes
     within 800 px of the screen. Its code and styles stay out of the first paint (the home page's
     own stylesheet must stay small enough to be inlined). The fallback (the section's heading and
     first line) is what the prerendered page and a visitor without JavaScript see. -->
<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { onMount } from "svelte";
  let { load, children }: { load: () => Promise<{ default: Component }>; children: Snippet } = $props();
  let Loaded: Component | null = $state(null);
  let box: HTMLDivElement;
  onMount(() => {
    const go = () => load().then((m) => (Loaded = m.default));
    if (typeof IntersectionObserver === "undefined") return void go();
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        go();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(box);
    return () => io.disconnect();
  });
</script>

<div class="lazy" bind:this={box}>
  {#if Loaded}<Loaded />{:else}{@render children()}{/if}
</div>

<style>
  .lazy { display: flex; flex-direction: column; gap: 16px; }
</style>
