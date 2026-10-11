<!-- O1 Hot spots (BR-K-6, SRS-HOT-1 to -3). Opens only from the menu; nothing links here on its own. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import Screen from "#lib/components/Screen.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Flame from "#lib/components/Flame.svelte";
  import Button from "#lib/components/Button.svelte";
  import { t } from "#lib/copy/index.ts";
  import { ApiError, loadHotspots, newestSpark, type HotspotEntryT } from "../more.ts";
  import { openGroup } from "../wire.ts";
  import { back } from "../back.ts";

  type View = { s: "loading" } | { s: "nogroup" } | { s: "error"; msg: string } | { s: "list"; places: HotspotEntryT[] };
  let view: View = $state({ s: "loading" });
  let sparks: Record<string, string> = $state({});

  async function load() {
    view = { s: "loading" };
    const g = await openGroup(page.url);
    if (!g) {
      view = { s: "nogroup" };
      return;
    }
    try {
      const places = await loadHotspots({ fetch, crypto: g.crypto }, g.group);
      view = { s: "list", places };
      // Newest Spark per place, top 5 only: one small request each, in order.
      for (const p of places.slice(0, 5)) {
        if (!p.spark_id) continue;
        const text = await newestSpark({ fetch, crypto: g.crypto }, g.group, p.place_key);
        if (text) sparks = { ...sparks, [p.place_key]: text };
      }
    } catch (e) {
      const kind = e instanceof ApiError ? e.kind : "server";
      view = { s: "error", msg: t(kind === "network" ? "err.network" : kind === "rateLimit" ? "err.rateLimit" : "err.server") };
    }
  }
  onMount(load);
</script>

<svelte:head><title>{t("hot.title")}</title></svelte:head>

<Screen title={t("hot.title")} onclose={back}>
  <h1 class="t-title">{t("hot.headline")}</h1>
  {#if view.s === "loading"}
    <p class="t-muted" role="status">{t("app.loading")}</p>
  {:else if view.s === "nogroup"}
    <p role="status">{t("more.noGroup")}</p>
  {:else if view.s === "error"}
    <p role="alert">{view.msg}</p>
    <Button variant="secondary" onclick={load}>{t("err.retry")}</Button>
  {:else if view.places.length === 0}
    <div class="empty">
      <Flame state="kindling" size={90} />
      <p>{t("hot.empty")}</p>
    </div>
  {:else}
    <ol class="list">
      {#each view.places as s, i (s.place_key)}
        <li class="spot">
          <span class="rank" aria-hidden="true">{i + 1}</span>
          <div class="body">
            <b>{s.place_name}</b>
            <span class="t-small t-muted">{t("hot.met", { n: s.count })}</span>
            {#if sparks[s.place_key]}<span class="t-small spark"><Icon name="spark" size={16} />{t("invite.sparkQuote", { line: sparks[s.place_key] })}</span>{/if}
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
