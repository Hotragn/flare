<!-- The shrink moment, loaded on demand (JS budget): one place for the import (I6, I9, H5). -->
<script lang="ts">
  let { lit = false }: { lit?: boolean } = $props();
</script>

{#await import("./Shrink.svelte") then { default: Shrink }}<Shrink {lit} />{/await}
