<!--
  Button. variant: primary (one per screen) | secondary | text | danger.
  Primary is 56 px tall and full width in the thumb zone. Labels are 3 words or fewer.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    variant = "primary",
    icon = "",
    loading = false,
    disabled = false,
    full = true,
    pressed = false,
    type = "button",
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
    border: 2px solid transparent; transition: transform var(--dur-instant) var(--ease-out), background var(--dur-quick), box-shadow var(--dur-quick);
    -webkit-tap-highlight-color: transparent; user-select: none;
  }
  .full { width: 100%; }
  .primary { min-height: var(--l-primary-height); background: var(--accent-bg); color: var(--on-accent); box-shadow: var(--e-2); }
  .primary:hover { filter: brightness(1.05); }
  .primary:active, .is-pressed.primary { transform: translateY(1px) scale(0.985); box-shadow: var(--e-1); }
  .secondary { background: transparent; color: var(--text); border-color: var(--text); }
  .secondary:active, .is-pressed.secondary { transform: scale(0.985); background: color-mix(in srgb, var(--text) 8%, transparent); }
  .text { background: transparent; color: var(--accent-text); min-height: var(--l-touch); padding: 0 12px; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; }
  .danger { background: transparent; color: var(--text); border-color: var(--c-ember-700); }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .spinner { width: 20px; height: 20px; border-radius: 50%; border: 3px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
</style>
