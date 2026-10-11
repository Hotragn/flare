<!-- O1 Hot spots: where the group actually meets (BR-K-6). Encrypted; opened only by choice. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Icon from "../components/Icon.svelte";
  import Flame from "../components/Flame.svelte";
  import { t } from "#lib/copy/index.ts";
  import { sparks } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "list", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} title={t("hot.title")}>
  <h1 class="t-title">{t("hot.headline")}</h1>
  {#if view === "empty"}
    <div class="empty">
      <Flame state="kindling" size={90} />
      <p>{t("hot.empty")}</p>
    </div>
  {:else}
    <ol class="list">
      {#each sparks as s, i}
        <li class="spot">
          <span class="rank" aria-hidden="true">{i + 1}</span>
          <div class="body">
            <b>{s.place}</b>
            <span class="t-small t-muted">{t("hot.met", { n: s.times + (i === 0 ? 1 : 0) })}</span>
            {#if s.line}<span class="t-small spark"><Icon name="spark" size={16} />{t("invite.sparkQuote", { line: s.line })}</span>{/if}
          </div>
        </li>
      {/each}
    </ol>
    <p class="t-small t-muted">{t("hot.private")} {t("hot.retention")}</p>
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
