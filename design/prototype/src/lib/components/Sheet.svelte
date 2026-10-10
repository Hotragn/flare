<!-- Bottom sheet on Bits UI Dialog: focus trap, Escape to close, labelled title, restores focus. -->
<script lang="ts">
  import { Dialog } from "bits-ui";
  import type { Snippet } from "svelte";
  let { open = $bindable(false), title, description = "", children, inline = false }: { open?: boolean; title: string; description?: string; children: Snippet; inline?: boolean } = $props();
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
      <Dialog.Content class="sheet">
        <div class="grab" aria-hidden="true"></div>
        <Dialog.Title class="t-heading">{title}</Dialog.Title>
        {#if description}<Dialog.Description class="t-muted desc">{description}</Dialog.Description>{/if}
        {@render children()}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

<style>
  :global(.overlay) { position: fixed; inset: 0; background: rgba(22, 35, 58, 0.45); z-index: 40; }
  :global(.sheet) {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; max-width: var(--l-max-width); margin: 0 auto;
    background: var(--surface); color: var(--text); border-radius: var(--r-xl) var(--r-xl) 0 0; padding: 10px var(--l-gutter) 28px;
    box-shadow: var(--e-3); display: flex; flex-direction: column; gap: 14px; animation: rise var(--dur-base) var(--ease-out) both;
  }
  .static { position: absolute; }
  .grab { width: 44px; height: 5px; border-radius: 3px; background: var(--line); margin: 0 auto 4px; }
  :global(.desc) { margin: 0; }
  @keyframes rise { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
