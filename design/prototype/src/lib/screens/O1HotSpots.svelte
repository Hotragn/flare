<!-- O1 Hot spots: where the group actually meets (BR-K-6). Encrypted; opened only by choice. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Icon from "../components/Icon.svelte";
  import Flame from "../components/Flame.svelte";
  import { sparks } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "list", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} title="Hot spots">
  <h1 class="t-title">Where your group meets</h1>
  {#if view === "empty"}
    <div class="empty">
      <Flame state="kindling" size={90} />
      <p>No places yet. Your first meetup starts the list.</p>
    </div>
  {:else}
    <ol class="list">
      {#each sparks as s, i}
        <li class="spot">
          <span class="rank" aria-hidden="true">{i + 1}</span>
          <div class="body">
            <b>{s.place}</b>
            <span class="t-small t-muted">Met here {s.times + (i === 0 ? 1 : 0)} {s.times + (i === 0 ? 1 : 0) === 1 ? "time" : "times"}</span>
            {#if s.line}<span class="t-small spark"><Icon name="spark" size={16} />"{s.line}"</span>{/if}
          </div>
        </li>
      {/each}
    </ol>
    <p class="t-small t-muted">Only your group can read this list. It's deleted after 180 quiet days.</p>
  {/if}
</Screen>

<style>
  h1, p { margin: 0; }
  .empty { flex: 1; display: grid; place-items: center; text-align: center; gap: 8px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .spot { display: flex; gap: 12px; padding: 14px; border-radius: var(--r-md); background: var(--surface); box-shadow: var(--e-1); }
  .rank { width: 32px; height: 32px; border-radius: 50%; background: var(--lit); color: var(--c-ink-900); display: grid; place-items: center; font-weight: 700; flex: none; }
  .body { display: flex; flex-direction: column; gap: 2px; }
  .spark { display: flex; gap: 6px; align-items: center; color: var(--accent-text); font-weight: 700; }
</style>
