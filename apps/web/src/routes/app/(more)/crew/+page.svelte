<!-- O8 Your crew (backlog #5): the crew's home. People as flame avatars, how many are out now,
     the week outside, the crew's story in numbers, your places as postcards, then one big Light a
     Flare. Everything to change sits behind one "Manage crew" sheet. Never shows who said no. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import Screen from "#lib/components/Screen.svelte";
  import Button from "#lib/components/Button.svelte";
  import Choice from "#lib/components/Choice.svelte";
  import FlameAvatars from "#lib/components/FlameAvatars.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Scenery from "#lib/components/Scenery.svelte";
  import ScenicHero from "#lib/components/ScenicHero.svelte";
  import Sheet from "#lib/components/Sheet.svelte";
  import TextField from "#lib/components/TextField.svelte";
  import { t } from "#lib/copy/index.ts";
  import { ApiError, type Crew, forgetGroup, hoursMinutes, loadCrew, loadHotspots, newestSpark, type HotspotEntryT } from "../more.ts";
  import { idemKey, openGroup } from "../wire.ts";
  import { back } from "../back.ts";

  type View = { s: "loading" } | { s: "nogroup" } | { s: "error"; msg: string } | { s: "ready"; crew: Crew; places: HotspotEntryT[] };
  let view = $state<View>({ s: "loading" });
  let sparks = $state<Record<string, string>>({});
  let manage = $state(false);
  let groupId = $state("");
  let name = $state("");
  let quorum = $state("2");
  let saved = $state("");
  let fresh = $state<"" | "ask" | "working" | "done">("");
  let opened: Awaited<ReturnType<typeof openGroup>> = null;
  const KEY = () => `flare.crew.${groupId}`;

  async function load() {
    view = { s: "loading" };
    const g = await openGroup(page.url);
    if (!g) {
      view = { s: "nogroup" };
      return;
    }
    groupId = g.group.groupId;
    opened = g;
    try {
      const local = JSON.parse(localStorage.getItem(KEY()) ?? "{}") as { name?: string; quorum?: string };
      // A crew started fresh carries the old name until it is renamed.
      const carried = JSON.parse(localStorage.getItem("flare.crew.carry") ?? "{}") as { name?: string };
      name = local.name ?? carried.name ?? "";
      quorum = local.quorum ?? "2";
    } catch {
      // private mode: defaults
    }
    try {
      const deps = { fetch, crypto: g.crypto };
      const [crew, places] = await Promise.all([
        loadCrew(deps, g.group, t("member.telegramFriend")),
        loadHotspots(deps, g.group).catch(() => [] as HotspotEntryT[]),
      ]);
      view = { s: "ready", crew, places };
      for (const p of places.slice(0, 3)) {
        if (!p.spark_id) continue;
        const line = await newestSpark(deps, g.group, p.place_key).catch(() => null);
        if (line) sparks = { ...sparks, [p.place_key]: line };
      }
    } catch (e) {
      const kind = e instanceof ApiError ? e.kind : "server";
      view = { s: "error", msg: t(kind === "network" ? "err.network" : "err.server") };
    }
  }
  onMount(load);

  function saveLocal() {
    try {
      localStorage.setItem(KEY(), JSON.stringify({ name: name.trim().slice(0, 40), quorum }));
      localStorage.setItem("flare.quorum", quorum); // Send starts from it
      saved = t("crew.saved");
    } catch {
      saved = "";
    }
  }
  /** Start fresh without someone: leave this crew on this phone and the server (Forget's own
   *  path), so the next Flare makes a new crew with a new key. The name and size carry over. */
  async function startFresh() {
    if (!opened) return;
    fresh = "working";
    try {
      localStorage.setItem("flare.crew.carry", JSON.stringify({ name: name.trim().slice(0, 40) }));
      await forgetGroup({ fetch, store: opened.store, idemKey }, opened.group);
      localStorage.removeItem("flare.hostGroup");
      fresh = "done";
    } catch {
      fresh = "ask";
    }
  }

  const week = $derived.by(() => {
    if (view.s !== "ready" || !view.crew.stats) return t("crew.weekNone");
    const min = view.crew.stats.outside_min_week;
    if (min <= 0) return t("crew.weekNone");
    const { h, m } = hoursMinutes(min);
    return h ? t("crew.week", { h, m }) : t("crew.weekMin", { m, n: m });
  });
  const statsLine = $derived.by(() => {
    if (view.s !== "ready" || !view.crew.stats) return "";
    const st = view.crew.stats;
    const { h, m } = hoursMinutes(st.outside_min);
    return t("crew.stats", { n: st.outings, outings: st.outings, time: h ? `${h} h ${m} min` : `${m} min`, embers: st.embers_saved });
  });
  const withG = (href: string) => (groupId ? `${href}?g=${groupId}` : href);
</script>

<svelte:head><title>{name || t("crew.title")}</title></svelte:head>

<Screen stage onclose={back} menu={false} title={name || t("crew.title")} heading={name || t("crew.title")}>
  {#snippet backdropArt()}<ScenicHero start={2} />{/snippet}
  {#snippet hero()}
    {#if view.s === "ready"}
      <div class="hero">
        <FlameAvatars people={view.crew.people.map((p) => ({ name: p.name, out: false }))} size={48} />
        {#if view.crew.outNow > 0}<p class="out"><span class="dot" aria-hidden="true"></span>{t("crew.outNow", { n: view.crew.outNow })}</p>{/if}
        <p class="t-display">{week}</p>
      </div>
    {/if}
  {/snippet}
  {#if view.s === "loading"}
    <p class="t-muted" role="status">{t("app.loading")}</p>
  {:else if view.s === "nogroup"}
    <p>{t("crew.empty")}</p>
  {:else if view.s === "error"}
    <p role="alert">{view.msg}</p>
    <Button variant="secondary" onclick={load}>{t("err.retry")}</Button>
  {:else}
    {#if statsLine}<p class="stats">{statsLine}</p>{/if}
    {#if view.places.length}
      <!-- ADR-0029: loaded on demand; drawn from the map pack on this phone. -->
      {#await Promise.all([import("#lib/components/CrewAtlas.svelte"), import("#lib/map/index.ts")]) then [{ default: CrewAtlas }, { maps }]}
        <CrewAtlas places={view.places} load={(a) => maps.load(a)} />
      {/await}
    {/if}
    <h2 class="t-heading">{t("crew.places")}</h2>
    {#if view.places.length}
      <ul class="cards">
        {#each view.places.slice(0, 6) as p (p.place_key)}
          <li class="postcard">
            <div class="art" aria-hidden="true"><Scenery people={false} /></div>
            <div class="txt">
              <b>{p.place_name}</b>
              <span>{t("hot.met", { n: p.count })}</span>
              {#if sparks[p.place_key]}<span class="spark"><Icon name="spark" size={16} />{t("invite.sparkQuote", { line: sparks[p.place_key] })}</span>{/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="t-small t-muted">{t("crew.placesEmpty")}</p>
    {/if}
    <p class="t-small t-muted">{t("crew.never")}</p>
  {/if}
  {#snippet actions()}
    <Button icon="camera" onclick={() => location.assign("/app/")}>{t("crew.light")}</Button>
    {#if view.s === "ready"}<Button variant="text" onclick={() => (manage = true)}>{t("crew.manage")}</Button>{/if}
  {/snippet}
  {#snippet overlay()}
    {#if view.s === "ready"}
      <Sheet bind:open={manage} title={t("crew.manage")}>
        <TextField label={t("crew.rename")} bind:value={name} max={40} />
        <Choice label={t("crew.quorum")} bind:value={quorum} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
        <Button variant="secondary" onclick={saveLocal}>{t("needs.save")}</Button>
        {#if saved}<p role="status">{saved}</p>{/if}
        <nav class="links">
          <a href={withG("/app/telegram/")}><Icon name="share" />{t("menu.tg")}</a>
          <a href={withG("/app/hotspots/")}><Icon name="hotspots" />{t("menu.hot")}</a>
          <a href="/app/needs/"><Icon name="bench" />{t("menu.needs")}</a>
          <a href={withG("/app/forget/")} class="danger"><Icon name="close" />{t("menu.forget")}</a>
        </nav>
        {#if fresh === ""}
          <Button variant="secondary" onclick={() => (fresh = "ask")}>{t("crew.fresh")}</Button>
        {:else if fresh === "done"}
          <p role="status">{t("crew.freshDone")}</p>
          <Button onclick={() => location.assign("/app/")}>{t("crew.light")}</Button>
        {:else}
          <h3>{t("crew.freshTitle")}</h3>
          <p>{t("crew.freshBody")}</p>
          <Button variant="danger" loading={fresh === "working"} onclick={startFresh}>{t("crew.freshYes")}</Button>
          <Button variant="text" onclick={() => (fresh = "")}>{t("crew.freshNo")}</Button>
        {/if}
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .hero { display: flex; flex-direction: column; gap: 10px; }
  .hero p { margin: 0; }
  .out { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c-gold-400); box-shadow: 0 0 12px var(--c-gold-400); animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.5; } }
  .stats { margin: 0; font-weight: 700; }
  h2 { margin: 4px 0 0; }
  .cards { list-style: none; margin: 0 calc(var(--l-gutter) * -1); padding: 0 var(--l-gutter); display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; }
  .postcard { position: relative; flex: 0 0 72%; min-height: 150px; border-radius: 20px; overflow: hidden; scroll-snap-align: start; display: flex; align-items: flex-end; }
  .postcard .art { position: absolute; inset: 0; }
  .postcard .art :global(svg) { width: 100%; height: 100%; display: block; }
  .postcard .txt { position: relative; width: 100%; padding: 12px; display: flex; flex-direction: column; gap: 2px; background: linear-gradient(to top, rgb(0 0 0 / 0.75), rgb(0 0 0 / 0)); }
  .spark { display: inline-flex; gap: 6px; align-items: center; color: var(--c-gold-400); font-weight: 700; }
  .links { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  .links a { min-height: 48px; display: flex; align-items: center; gap: 10px; color: inherit; font-weight: 700; text-decoration: none; }
  .links a.danger { color: var(--c-ember-700); }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
</style>
