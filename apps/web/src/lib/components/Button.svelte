<!--
  Button. variant: primary (one per screen) | secondary | text | danger.
  Primary is 56 px tall and full width in the thumb zone. Labels are 3 words or fewer.
  Press (docs/design/motion.md 3.9): down to 97% and 1 px lower in 90 ms, back on the
  spring in 160 ms. Reduced motion: no scale, the color darkens instead.
  haptic: "tap" makes the tap tick on phones that can (see src/lib/motion/haptics.ts).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import { hapticTap, type HapticKind } from "#lib/motion/haptics.ts";
  const maybeHaptic = (node: HTMLElement, kind: HapticKind | undefined) => (kind ? hapticTap(node, kind) : undefined);

  let {
    variant = "primary",
    icon = "",
    loading = false,
    disabled = false,
    full = true,
    pressed = false,
    type = "button",
    haptic,
    onclick,
    children,
    ...rest
  }: {
    variant?: "primary" | "secondary" | "text" | "danger";
    icon?: string;
    loading?: boolean;
    disabled?: boolean;
    full?: boolean;
    pressed?: boolean;
    type?: "button" | "submit";
    haptic?: HapticKind;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    [k: string]: unknown;
  } = $props();
</script>

<button
  class="btn {variant}"
  class:full
  class:is-pressed={pressed}
  {type}
  disabled={disabled || loading}
  aria-busy={loading || undefined}
  {onclick}
  use:maybeHaptic={haptic}
  {...rest}
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {:else if icon}
    <Icon name={icon} size={22} />
  {/if}
  <span class="label">{@render children()}</span>
</button>

<style>
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    min-height: var(--l-touch); padding: 0 20px; border-radius: var(--r-pill);
    font-size: calc(var(--t-label-size) * var(--text-scale)); font-weight: 700; letter-spacing: var(--t-label-tracking);
    border: 2px solid transparent;
    transition: transform var(--dur-quick) var(--ease-spring), background var(--dur-quick) var(--ease-out), box-shadow var(--dur-quick) var(--ease-out), filter var(--dur-quick);
    -webkit-tap-highlight-color: transparent; user-select: none;
  }
  .full { width: 100%; }
  .primary { min-height: var(--l-primary-height); background: var(--accent-bg); color: var(--on-accent); box-shadow: var(--e-2); }
  .primary:hover { filter: brightness(1.05); }
  .btn:active, .is-pressed { transition-duration: var(--dur-instant); transition-timing-function: var(--ease-out); }
  .primary:active, .is-pressed.primary { transform: translateY(1px) scale(0.97); box-shadow: var(--e-1); }
  .secondary { background: transparent; color: var(--text); border-color: var(--text); }
  .secondary:active, .is-pressed.secondary { transform: scale(0.97); background: color-mix(in srgb, var(--text) 8%, transparent); }
  .text:active, .danger:active { transform: scale(0.97); }
  @media (prefers-reduced-motion: reduce) {
    .btn:active, .is-pressed { transform: none !important; }
    .primary:active, .is-pressed.primary { filter: brightness(0.9); }
  }
  :global([data-reduce-motion]) .btn:active, :global([data-reduce-motion]) .is-pressed { transform: none !important; }
  :global([data-reduce-motion]) .primary:active, :global([data-reduce-motion]) .is-pressed.primary { filter: brightness(0.9); }
  .text { background: transparent; color: var(--accent-text); min-height: var(--l-touch); padding: 0 12px; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; }
  .danger { background: transparent; color: var(--text); border-color: var(--c-ember-700); }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .spinner { width: 20px; height: 20px; border-radius: 50%; border: 3px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
</style>
