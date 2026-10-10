<!-- O0 Menu: the only global navigation, opened from the camera (44 pt button). -->
<script lang="ts">
  import Sheet from "../components/Sheet.svelte";
  import Icon from "../components/Icon.svelte";
  import { t, type CopyKey } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  import Screen from "../components/Screen.svelte";
  let { view = "open", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  const items: [string, CopyKey, CopyKey][] = [
    ["plan", "menu.plan", "menu.planSub"],
    ["hotspots", "menu.hot", "menu.hotSub"],
    ["bench", "menu.needs", "menu.needsSub"],
    ["card", "menu.loop", "menu.loopSub"],
    ["mapfix", "menu.map", "menu.mapSub"],
    ["info", "menu.check", "menu.checkSub"],
    ["spark", "menu.ai", "menu.aiSub"],
    ["close", "menu.forget", "menu.forgetSub"],
  ];
</script>

<Screen {theme} {wire} menu close={false} grain={false}>
  <div class="dim" aria-hidden="true"></div>
  {#snippet overlay()}
    <Sheet inline title={t("menu.title")}>
      <ul class="menu">
        {#each items as [icon, label, sub]}
          <li><button class="row"><Icon name={icon} /><span class="txt"><b>{t(label)}</b><span class="t-small t-muted">{t(sub)}</span></span><Icon name="chevron" size={20} /></button></li>
        {/each}
      </ul>
      <p class="t-small t-muted foot">{t("menu.foot")}</p>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .dim { flex: 1; border-radius: var(--r-photo); background: var(--c-dusk-800); }
  .menu { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .row { width: 100%; min-height: 60px; display: flex; gap: 12px; align-items: center; padding: 6px 4px; border: 0; background: transparent; text-align: left; border-bottom: 1px solid var(--line); }
  .txt { flex: 1; display: flex; flex-direction: column; }
  .foot { margin: 0; text-align: center; }
</style>
