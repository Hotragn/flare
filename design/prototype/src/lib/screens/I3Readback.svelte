<!-- I3 Read-back: the parsed rule in one sentence (≤ 12 words, SRS-COND-5). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "flare", theme = "light", wire = false, onyes }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void } = $props();
  const line = $derived(view === "plan" ? "Got it: step 3 or smaller, back by 5 PM. Right?" : "Got it: only with Amor, back by 5 PM. Right?");
</script>

<Screen {theme} {wire} title="From Fuego">
  <PhotoPrint scene={flare.scene} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title="Check this">
      <p class="t-title readback" aria-live="polite">{line}</p>
      <ul class="chips" aria-label="Rules that will be sent">
        {#if view === "plan"}<li>Step 3 or smaller</li>{:else}<li>Only with Amor</li>{/if}
        <li>Back by 5:00 PM</li>
      </ul>
      <Button onclick={onyes}>Yes, I'm in</Button>
      <Button variant="text">Fix it</Button>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .readback { margin: 0; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
  .chips li { padding: 8px 14px; border-radius: var(--r-pill); background: var(--bg); border: 2px solid var(--line); font-weight: 700; }
</style>
