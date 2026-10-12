<!-- Parts loaded on demand (JS budget), behind one import point so screens share the cost:
     the drawn scene under the live sky (kind "scenery", until it arrives the screen's warm light
     shows) and the shrink moment (kind "shrink", I6, I9, H5). Props pass through. -->
<script lang="ts">
  import type { Component } from "svelte";
  import type { SkyInput } from "#lib/motion/sky.ts";
  let {
    kind,
    people = true,
    sky = undefined,
    lit = false,
  }: { kind: "scenery" | "shrink"; people?: boolean; sky?: SkyInput; lit?: boolean } = $props();
  // biome-ignore lint/suspicious/noExplicitAny: two components, each takes its own props.
  const load = (): Promise<{ default: Component<any> }> => (kind === "shrink" ? import("./Shrink.svelte") : import("./Scenery.svelte"));
</script>

{#await load() then { default: Part }}<Part {people} {sky} {lit} />{/await}
