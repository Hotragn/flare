<!-- H1 Camera. Opens straight to a live camera (SRS-CRE-1). One tap captures. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import Sheet from "../components/Sheet.svelte";
  import SampleScene from "../components/SampleScene.svelte";
  import type { Theme } from "../components/parts";
  let { view = "live", theme = "light", wire = false, onshoot, onmenu }: { view?: string; theme?: Theme; wire?: boolean; onshoot?: () => void; onmenu?: () => void } = $props();
</script>

<Screen {theme} {wire} menu close={false} grain={false} {onmenu}>
  <div class="viewfinder" class:off={view !== "live"}>
    {#if view === "live"}
      <div class="live photo-art"><SampleScene /></div>
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    {:else if view === "loading"}
      <p class="msg t-heading" role="status">Opening camera…</p>
    {:else if view === "denied"}
      <div class="msg"><Icon name="camera" size={40} /><p class="t-heading">Camera is off.</p><p class="t-muted">Pick a photo of where you are instead.</p></div>
    {/if}
  </div>
  <p class="hint t-small t-muted">{view === "denied" ? "You can turn the camera on in Settings." : "Point at where you are."}</p>
  {#snippet actions()}
    {#if view === "denied"}
      <Button icon="camera">Pick a photo</Button>
    {:else}
      <div class="shutter-row">
        <button class="shutter" aria-label="Take the photo" disabled={view !== "live"} onclick={onshoot}><span></span></button>
      </div>
    {/if}
  {/snippet}
  {#snippet overlay()}
    {#if view === "permission"}
      <Sheet inline title="Snap where you are" description="Flare uses the camera for one photo. It's encrypted before it leaves your phone.">
        <Button icon="camera">Allow camera</Button>
        <Button variant="text">Pick a photo</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .viewfinder { position: relative; flex: 1; min-height: 480px; border-radius: var(--r-photo); overflow: hidden; background: var(--c-dusk-900); display: grid; place-items: center; color: var(--c-birch-100); }
  .live { position: absolute; inset: 0; }
  .live :global(svg) { width: 100%; height: 100%; }
  .corner { position: absolute; width: 34px; height: 34px; border: 4px solid var(--c-birch-50); opacity: 0.9; }
  .tl { top: 18px; left: 18px; border-right: 0; border-bottom: 0; border-radius: 12px 0 0 0; }
  .tr { top: 18px; right: 18px; border-left: 0; border-bottom: 0; border-radius: 0 12px 0 0; }
  .bl { bottom: 18px; left: 18px; border-right: 0; border-top: 0; border-radius: 0 0 0 12px; }
  .br { bottom: 18px; right: 18px; border-left: 0; border-top: 0; border-radius: 0 0 12px 0; }
  .msg { text-align: center; display: grid; justify-items: center; gap: 6px; padding: 24px; }
  .msg p { margin: 0; }
  .msg .t-muted { color: var(--c-dusk-300); }
  .hint { text-align: center; margin: 0; }
  .shutter-row { display: flex; justify-content: center; }
  .shutter { width: 84px; height: 84px; border-radius: 50%; border: 5px solid var(--text); background: transparent; padding: 5px; transition: transform var(--dur-instant) var(--ease-out); }
  .shutter span { display: block; width: 100%; height: 100%; border-radius: 50%; background: var(--lit); }
  .shutter:active { transform: scale(0.92); }
  .shutter:disabled { opacity: 0.4; }
</style>
