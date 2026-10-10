<!-- I5 This spot may not suit you. Private to this person; their yes moves to the Ember (SRS-ACC-3). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import Icon from "../components/Icon.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "prompt", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} title="From Fuego">
  <PhotoPrint scene={flare.scene} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title="This spot may not suit you" description="Only you see this. Your needs stay on your phone.">
      <ul class="why">
        <li><Icon name="steps" /><span>Steps mapped near the spot</span></li>
        <li><Icon name="bench" /><span>Nearest bench 320 m</span></li>
      </ul>
      <p class="t-sun">Count me in for a closer one?</p>
      <Button>Count me in</Button>
      <Button variant="text">Not now</Button>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .why { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-weight: 700; }
  .why li { display: flex; gap: 8px; align-items: center; }
  .t-sun { margin: 0; }
</style>
