<!-- H6 Host, Lit (sun mode). Arrivals and +1 (BR-H-*). Done ends it for everyone. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import Sheet from "../components/Sheet.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import { people, flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "lit", theme = "sun", wire = false, ondone }: { view?: string; theme?: Theme; wire?: boolean; ondone?: () => void } = $props();
  const here = $derived(view === "lit" ? 1 : 3);
</script>

<Screen {theme} {wire} sound title={t("host.lit.title")}>
  <div class="center">
    <Hearth state="lit" size={210} celebrate />
    <h1 class="t-display">{t("host.lit.headline")}</h1>
    <p class="t-sun">{t("host.lit.coming", { n: flare.coming, spot: "the bench by the pond" })}</p>
  </div>
  <div class="here" aria-live="polite">
    <span class="t-heading">{t("host.lit.here", { n: here })}</span>
    <Button variant="secondary" icon="plusone" full={false}>{t("host.lit.addOne")}</Button>
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>{t("host.lit.done")}</Button>
  {/snippet}
  {#snippet overlay()}
    {#if view === "plusone"}
      <Sheet inline title={t("host.plus.title")} description={t("host.plus.body")}>
        <ul class="names">
          {#each people.friends as n, i}
            <li><button class="row" aria-pressed={i < 2}><span>{n}</span>{#if i < 2}<Icon name="here" />{/if}</button></li>
          {/each}
          <li><button class="row"><span>{t("host.plus.someone")}</span><Icon name="plusone" /></button></li>
        </ul>
      </Sheet>
    {:else if view === "done"}
      <Sheet inline title={t("host.done.title")} description={t("host.done.body")}>
        <Button>{t("host.done.yes")}</Button>
        <Button variant="text">{t("host.done.no")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .here { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--surface); border-radius: var(--r-md); border: 2px solid var(--line); }
  .names { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .row { width: 100%; min-height: 52px; display: flex; justify-content: space-between; align-items: center; padding: 0 16px; border-radius: var(--r-md); border: 2px solid var(--line); background: var(--bg); font-weight: 700; }
  .row[aria-pressed="true"] { border-color: var(--positive); }
</style>
