<!-- The drawn scene, loaded on demand (JS budget): one place for the import, so every screen
     shares it. Until it arrives the screen's warm light shows. Props pass through to Scenery. -->
<script lang="ts">
  import type { SkyInput } from "#lib/motion/sky.ts";
  let { people = true, sky = undefined }: { people?: boolean; sky?: SkyInput } = $props();
</script>

{#await import("./Scenery.svelte") then { default: Scenery }}<Scenery {people} {sky} />{/await}
