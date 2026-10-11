<!-- H1 Camera. Opens straight to a live camera (SRS-CRE-1). One tap captures; a picked photo works too. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import Sheet from "../components/Sheet.svelte";
  import SampleScene from "../components/SampleScene.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "live",
    theme = "light",
    stream = null,
    sample = false,
    onshoot,
    onpick,
    onallow,
    onmenu,
    onvoice,
  }: {
    view?: "live" | "permission" | "denied" | "loading";
    theme?: Theme;
    stream?: MediaStream | null;
    sample?: boolean;
    onshoot?: (video: HTMLVideoElement | null) => void;
    /** Voice Flare (ADR-0028): the hub's draft from what the host said. */
    onvoice?: (d: { invite: string; alt: string }) => void;
    onpick?: (file: File) => void;
    onallow?: () => void;
    onmenu?: () => void;
  } = $props();
  let video: HTMLVideoElement | null = $state(null);
  let input: HTMLInputElement | null = $state(null);
  $effect(() => {
    if (video && stream && video.srcObject !== stream) video.srcObject = stream;
  });
  const picked = (e: Event) => {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (f) onpick?.(f);
  };
</script>

<Screen {theme} heading={t("camera.heading")} menu close={false} grain={false} {onmenu}>
  <div class="viewfinder" class:off={view !== "live"}>
    {#if view === "live"}
      <div class="live">
        {#if stream}<video bind:this={video} autoplay playsinline muted aria-hidden="true"></video>{:else if sample}<SampleScene />{/if}
      </div>
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    {:else if view === "loading"}
      <p class="msg t-heading" role="status">{t("camera.loading")}</p>
    {:else if view === "denied"}
      <div class="msg"><Icon name="camera" size={40} /><p class="t-heading">{t("camera.denied.title")}</p><p class="t-muted">{t("camera.denied.body")}</p></div>
    {/if}
  </div>
  <p class="hint t-small t-muted">{view === "denied" ? t("camera.denied.howto") : t("camera.hint")}</p>
  <input bind:this={input} class="visually-hidden" type="file" accept="image/*" capture="environment" tabindex="-1" aria-hidden="true" onchange={picked} />
  {#snippet actions()}
    {#if view === "denied"}
      <Button icon="camera" onclick={() => input?.click()}>{t("camera.pick")}</Button>
    {:else}
      <div class="shutter-row">
        <button class="shutter" aria-label={t("camera.shutter")} disabled={view !== "live"} onclick={() => (stream ? onshoot?.(video) : input?.click())}><span></span></button>
      </div>
    {/if}
    {#if onvoice && typeof MediaRecorder !== "undefined"}
      <!-- Loaded on demand, so the camera screen stays inside the JS budget. -->
      {#await import("../components/SayFlare.svelte") then { default: SayFlare }}<SayFlare ondraft={onvoice} />{/await}
    {/if}
  {/snippet}
  {#snippet overlay()}
    {#if view === "permission"}
      <Sheet inline title={t("perm.camera.title")} description={t("perm.camera.body")}>
        <Button icon="camera" onclick={onallow}>{t("perm.camera.allow")}</Button>
        <Button variant="text" onclick={() => input?.click()}>{t("perm.camera.alt")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .viewfinder { position: relative; flex: 1; min-height: 480px; border-radius: var(--r-photo); overflow: hidden; background: var(--c-dusk-900); display: grid; place-items: center; color: var(--c-birch-100); }
  .live { position: absolute; inset: 0; }
  .live :global(svg), .live video { width: 100%; height: 100%; object-fit: cover; }
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
