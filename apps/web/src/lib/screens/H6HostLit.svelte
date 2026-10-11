<!-- H6 Host, Lit (sun mode). Arrivals and +1 (BR-H-1 to -5). Done ends it for everyone (BR-F-5). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import Sheet from "../components/Sheet.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "lit",
    theme = "sun",
    coming = 1,
    spot = "",
    here = 0,
    members = [],
    marked = [],
    error = "",
    busy = false,
    onplusone,
    ondone,
    onclose,
  }: {
    view?: "lit" | "arrivals" | "plusone" | "done";
    theme?: Theme;
    coming?: number;
    spot?: string;
    here?: number;
    members?: { id: string; name: string }[]; // names opened on this phone; only the host sees them
    marked?: string[];
    error?: string;
    busy?: boolean;
    onplusone?: (who: { id: string } | "someone_else") => void;
    ondone?: () => void;
    onclose?: () => void;
  } = $props();
  // svelte-ignore state_referenced_locally
  let sheet = $state<"" | "plusone" | "done">(view === "plusone" || view === "done" ? view : "");
</script>

<Screen {theme} sound {onclose} title={t("host.lit.title")}>
  <div class="center">
    <Hearth state="lit" size={210} celebrate={view === "lit"} />
    <h1 class="t-display">{t("host.lit.headline")}</h1>
    {#if spot}<p class="t-sun">{t("host.lit.coming", { n: coming, spot })}</p>{/if}
  </div>
  <div class="here" aria-live="polite">
    <span class="t-heading">{t("host.lit.here", { n: here })}</span>
    <Button variant="secondary" icon="plusone" full={false} onclick={() => (sheet = "plusone")}>{t("host.lit.addOne")}</Button>
  </div>
  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#snippet actions()}
    <Button onclick={() => (sheet = "done")}>{t("host.lit.done")}</Button>
  {/snippet}
  {#snippet overlay()}
    {#if sheet === "plusone"}
      <Sheet inline title={t("host.plus.title")} description={t("host.plus.body")}>
        <ul class="names">
          {#each members as m (m.id)}
            {@const on = marked.includes(m.id)}
            <li><button class="row" aria-pressed={on} disabled={on || busy} onclick={() => onplusone?.({ id: m.id })}><span>{m.name}</span>{#if on}<Icon name="here" />{/if}</button></li>
          {/each}
          <li><button class="row" disabled={busy} onclick={() => onplusone?.("someone_else")}><span>{t("host.plus.someone")}</span><Icon name="plusone" /></button></li>
        </ul>
        <Button variant="text" onclick={() => (sheet = "")}>{t("app.close")}</Button>
      </Sheet>
    {:else if sheet === "done"}
      <Sheet inline title={t("host.done.title")} description={t("host.done.body")}>
        <Button loading={busy} onclick={() => { sheet = ""; ondone?.(); }}>{t("host.done.yes")}</Button>
        <Button variant="text" onclick={() => (sheet = "")}>{t("host.done.no")}</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 24ch; }
  .here { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line); }
  .names { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .row { width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--r-md); border: 2px solid var(--line); background: var(--surface); color: var(--text); font: inherit; font-weight: 700; }
  .row[aria-pressed="true"] { border-color: var(--lit); }
  .err { font-weight: 700; margin: 0; text-align: center; }
</style>
