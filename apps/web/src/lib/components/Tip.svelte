<!-- First-time tip (backlog #4): one line, dismissible, shown once per tip id on this phone. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { t, type CopyKey } from "#lib/copy/index.ts";
  import Icon from "./Icon.svelte";
  let { id, text }: { id: string; text: CopyKey } = $props();
  const KEY = "flare.tips";
  let show = $state(false);
  const seen = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  };
  onMount(() => {
    show = !seen().includes(id);
  });
  function close() {
    show = false;
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen(), id].slice(-40)));
    } catch {
      // private mode: the tip shows again next time
    }
  }
</script>

{#if show}
  <div class="tip" role="note">
    <Icon name="info" size={18} />
    <span>{t(text)}</span>
    <button aria-label={t("app.close")} onclick={close}><Icon name="close" size={18} /></button>
  </div>
{/if}

<style>
  .tip { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 14px; background: rgb(255 255 255 / 0.14);
    font-size: calc(var(--t-small-size) * var(--text-scale)); font-weight: 600; }
  .tip span { flex: 1; }
  button { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 0; background: transparent; color: inherit; border-radius: 50%; }
</style>
