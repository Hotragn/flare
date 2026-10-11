<!-- Bottom sheet on Bits UI Dialog: focus trap, Escape to close, labelled title, restores focus.
     Motion (docs/design/motion.md 3.8): enters by rising 24 px with a fade (260 ms, ease-out),
     leaves by dropping 32 px with a fade (160 ms, ease-in); Bits UI waits for the exit animation.
     Drag the handle down to dismiss: past 30% of the sheet height or faster than 0.6 px/ms
     it closes; otherwise it springs back (--spring-sheet). Reduced motion: fades only. -->
<script lang="ts">
  import { Dialog } from "bits-ui";
  import type { Snippet } from "svelte";
  let { open = $bindable(false), title, description = "", children, inline = false }: { open?: boolean; title: string; description?: string; children: Snippet; inline?: boolean } = $props();

  let ref: HTMLElement | null = $state(null);
  let drag = $state(0);
  let dragging = $state(false);
  let startY = 0, lastY = 0, lastT = 0, vel = 0;

  function down(e: PointerEvent) {
    if (!ref) return;
    dragging = true;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    vel = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const dt = Math.max(1, e.timeStamp - lastT);
    vel = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastT = e.timeStamp;
    drag = Math.max(0, e.clientY - startY);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    const h = ref?.offsetHeight ?? 400;
    if (drag > h * 0.3 || vel > 0.6) open = false;
    else drag = 0;
  }
  $effect(() => { if (open) drag = 0; });
</script>

{#if inline}
  <!-- Static rendering for screenshots and the component catalog. -->
  <div class="overlay static"></div>
  <section class="sheet static" aria-label={title}>
    <div class="grab" aria-hidden="true"></div>
    <h2 class="t-heading">{title}</h2>
    {#if description}<p class="t-muted desc">{description}</p>{/if}
    {@render children()}
  </section>
{:else}
  <Dialog.Root bind:open>
    <Dialog.Portal>
      <Dialog.Overlay class="overlay" />
      <Dialog.Content class="sheet" bind:ref style="--drag: {drag}px" data-dragging={dragging || undefined}>
        <div class="handle" aria-hidden="true" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
          <div class="grab"></div>
        </div>
        <Dialog.Title class="t-heading">{title}</Dialog.Title>
        {#if description}<Dialog.Description class="t-muted desc">{description}</Dialog.Description>{/if}
        {@render children()}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

<style>
  :global(.overlay) { position: fixed; inset: 0; background: rgba(22, 35, 58, 0.45); z-index: 40; animation: fade-in var(--dur-base) var(--ease-out) both; }
  :global(.overlay[data-state="closed"]) { animation: fade-out var(--dur-quick) var(--ease-in) both; }
  :global(.sheet) {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; max-width: var(--l-max-width); margin: 0 auto;
    background: var(--surface); color: var(--text); border-radius: var(--r-xl) var(--r-xl) 0 0; padding: 10px var(--l-gutter) 28px;
    box-shadow: var(--e-3); display: flex; flex-direction: column; gap: 14px; animation: rise var(--dur-base) var(--ease-out) both;
    transform: translateY(var(--drag, 0px)); transition: transform var(--spring-sheet-dur) var(--spring-sheet);
  }
  :global(.sheet[data-dragging]) { transition: none; }
  :global(.sheet[data-state="closed"]) { animation: drop var(--dur-quick) var(--ease-in) both; }
  .static { position: absolute; }
  .handle { margin: -10px auto 0; width: 100%; height: 28px; display: grid; place-items: center; touch-action: none; cursor: grab; }
  .grab { width: 44px; height: 5px; border-radius: 3px; background: var(--line); margin: 0 auto 4px; }
  :global(.desc) { margin: 0; }
  @keyframes rise { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(var(--drag, 0px)); opacity: 1; } }
  @keyframes drop { from { transform: translateY(var(--drag, 0px)); opacity: 1; } to { transform: translateY(calc(var(--drag, 0px) + 32px)); opacity: 0; } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    :global(.sheet:not(.static)) { animation: fade-in var(--dur-fade) linear both; transition: none; }
    .static { animation: none; }
    :global(.sheet[data-state="closed"]) { animation: fade-out var(--dur-fade) linear both; }
    :global(.overlay), :global(.overlay[data-state="closed"]) { animation-duration: var(--dur-fade); }
  }
  :global([data-reduce-motion] .sheet:not(.static)) { animation: fade-in var(--dur-fade) linear both; transition: none; }
  :global([data-reduce-motion]) .static { animation: none; }
</style>
