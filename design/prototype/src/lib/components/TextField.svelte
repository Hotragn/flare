<!-- Text field with a visible label, hint or error, optional mic (dictation), and counter. -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import Icon from "./Icon.svelte";
  let {
    label, value = $bindable(""), placeholder = "", hint = "", error = "", mic = false, listening = false,
    max = 0, multiline = false, id = "f" + Math.random().toString(36).slice(2, 8),
  }: { label: string; value?: string; placeholder?: string; hint?: string; error?: string; mic?: boolean; listening?: boolean; max?: number; multiline?: boolean; id?: string } = $props();
</script>

<div class="field" class:has-error={!!error}>
  <label for={id} class="lbl">{label}</label>
  <div class="box" class:listening>
    {#if multiline}
      <textarea {id} bind:value {placeholder} rows="3" maxlength={max || undefined} aria-invalid={!!error} aria-describedby="{id}-msg"></textarea>
    {:else}
      <input {id} bind:value {placeholder} maxlength={max || undefined} aria-invalid={!!error} aria-describedby="{id}-msg" autocomplete="off" />
    {/if}
    {#if mic}
      <button class="mic" type="button" aria-label={listening ? t("cond.stopDictate") : t("cond.dictate")} aria-pressed={listening}><Icon name="mic" /></button>
    {/if}
  </div>
  <div class="msg t-small" id="{id}-msg" aria-live="polite">
    {#if error}<Icon name="warning" size={18} /><span>{error}</span>{:else if hint}<span class="t-muted">{hint}</span>{/if}
    {#if max}<span class="count t-muted">{value.length}/{max}</span>{/if}
  </div>
</div>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; }
  .lbl { font-weight: 700; }
  .box { display: flex; align-items: flex-start; gap: 6px; background: var(--surface); border: 2px solid var(--text-muted); border-radius: var(--r-md); padding: 4px 4px 4px 14px; transition: border-color var(--dur-quick); }
  .box:focus-within { border-color: var(--text); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-gold-400) 70%, transparent); }
  .listening { border-color: var(--lit); }
  .has-error .box { border-color: var(--c-ember-700); }
  input, textarea { flex: 1; min-height: 44px; border: 0; background: transparent; outline: none; font-size: calc(var(--t-body-size) * var(--text-scale)); padding: 8px 0; resize: none; }
  .mic { width: 44px; height: 44px; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--text) 8%, transparent); display: grid; place-items: center; }
  .listening .mic { background: var(--lit); color: var(--c-ink-900); }
  .msg { display: flex; align-items: center; gap: 6px; min-height: 22px; }
  .has-error .msg { color: var(--text); font-weight: 700; }
  .count { margin-left: auto; }
</style>
