<!-- Plan ladder: 4 steps, biggest first. current marks the lit step; editable shows edit buttons. -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import Icon from "./Icon.svelte";
  import type { Step } from "./parts";
  let { steps, current = 0, editable = false, editing = -1 }: { steps: Step[]; current?: number; editable?: boolean; editing?: number } = $props();
</script>

<ol class="ladder" aria-label={t("ladder.aria")}>
  {#each steps as s, i}
    <li class="step" class:current={current === i + 1} class:past={current > 0 && i + 1 < current} class:editing={editing === i}>
      <span class="num" aria-hidden="true">{i + 1}</span>
      <div class="body">
        <span class="name">{s.name}</span>
        <span class="t-small t-muted">{t("ladder.stepMeta", { place: s.place, min: s.minutes, access: s.access })}</span>
        {#if s.afterSunset}<span class="t-small warn"><Icon name="sunset" size={18} />{t("ladder.afterSunset")}</span>{/if}
      </div>
      {#if editable}<button class="edit" aria-label={t("ladder.editAria", { k: i + 1 })}><Icon name="edit" /></button>{/if}
      {#if current === i + 1}<span class="visually-hidden">{t("ladder.current")}</span>{/if}
    </li>
  {/each}
</ol>

<style>
  .ladder { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .step { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 14px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line); }
  .current { border-color: var(--lit); box-shadow: var(--e-2); }
  .past { background: transparent; }
  .past .name, .past .num { color: var(--text-muted); }
  .editing { border-style: dashed; border-color: var(--text); }
  .num { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; background: color-mix(in srgb, var(--text) 8%, transparent); flex: none; }
  .current .num { background: var(--lit); color: var(--c-ink-900); }
  .body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .name { font-weight: 700; }
  .warn { display: inline-flex; gap: 4px; align-items: center; font-weight: 700; color: var(--accent-text); }
  .edit { width: 44px; height: 44px; border-radius: 50%; border: 0; background: transparent; display: grid; place-items: center; }
</style>
