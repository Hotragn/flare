<script lang="ts">
  import { icons } from "#lib/brand.ts";
  let { name, size = 24, label = "" }: { name: string; size?: number; label?: string } = $props();
  const svg = $derived((icons[name] ?? "").replace('width="24" height="24"', `width="${size}" height="${size}"`));
</script>

<span class="icon" style:width="{size}px" style:height="{size}px" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : "true"}>
  {@html svg}
</span>

<style>
  .icon { display: inline-flex; flex: none; color: currentColor; }
  .icon :global(svg) { width: 100%; height: 100%; }
</style>
