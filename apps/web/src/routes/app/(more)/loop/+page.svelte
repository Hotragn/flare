<!-- O5 Bench to Bench (SRS-REST-1 to -6, E16): words to a loop with seats close together, and a
     large-print card. Everything runs on the phone: the words, the location and the route never
     leave it (SRS-PRIV-1). Loops need a bundled walking map (docs/maps/05-rest-loops.md). -->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Screen from "#lib/components/Screen.svelte";
  import Button from "#lib/components/Button.svelte";
  import TextField from "#lib/components/TextField.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import { parseRest, restReadBack, type LoopRequest as Ask, type Needs } from "#lib/conditions/rest.ts";
  import { askLocation } from "#lib/permissions/index.ts";
  import { buildLoop, cardLines, cardPdf, loadNear, loadPathsNear, speakTurns, type Loop } from "#lib/map/index.ts";
  import { nameSpot } from "#lib/map/places.ts";
  import { readNeeds } from "../more.ts";
  import { phoneModules } from "../wire.ts";
  import { back } from "../back.ts";

  type View =
    | { s: "request"; error: string }
    | { s: "readback"; ask: Ask }
    | { s: "finding" }
    | { s: "loop"; loop: Loop; place: string }
    | { s: "none"; message: string; next: 200 | 400 | null; ask: Ask };
  let view = $state<View>({ s: "request", error: "" });
  let words = $state("");
  let needs: Needs | null = null;
  let reading = $state(false);
  let stopReading: (() => void) | null = null;

  onMount(async () => {
    const { store } = await phoneModules();
    const n = store ? await readNeeds(store).catch(() => null) : null;
    if (n) needs = { avoidSteps: n.avoid_steps, maxRestGap: n.rest_gap_m, restroomNear: n.restroom_300m };
  });
  onDestroy(() => stopReading?.());

  function check() {
    const r = parseRest(words, needs);
    view = r.ok ? { s: "readback", ask: r.request } : { s: "request", error: t("loop.hint") };
  }

  async function make(ask: Ask) {
    view = { s: "finding" };
    const at = await askLocation({ timeoutMs: 15_000 });
    if (!at.ok) {
      view = { s: "request", error: t("loop.noLocation") };
      return;
    }
    const spot = { lat: at.coords.lat, lon: at.coords.lon };
    const [pack, paths] = await Promise.all([loadNear(spot).catch(() => null), loadPathsNear(spot)]);
    if (!pack || !paths) {
      view = { s: "request", error: t("loop.noMap") };
      return;
    }
    const place = nameSpot(pack.pack, spot)?.name ?? t("loop.path.unnamed");
    const prefer = ask.prefer.filter((p): p is "trees" | "water" => p !== "restrooms");
    const r = buildLoop(pack.pack, paths, spot, { minutes: ask.minutes, rest_gap_m: ask.restGapM, avoid_steps: ask.avoidSteps, prefer }, place);
    view = r.ok ? { s: "loop", loop: r.loop, place } : { s: "none", message: r.message, next: r.next_gap_m, ask };
  }

  function print(loop: Loop, place: string) {
    const url = URL.createObjectURL(new Blob([cardPdf(loop, place) as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "bench-to-bench.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function read(loop: Loop) {
    if (reading) {
      stopReading?.();
      reading = false;
      return;
    }
    stopReading = speakTurns(loop.turns);
    reading = true;
  }

  const readback = $derived(view.s === "readback" ? restReadBack(view.ask) : null);
  const lines = $derived(view.s === "loop" ? cardLines(view.loop, view.place) : []);
</script>

<svelte:head><title>{t("loop.title")}</title></svelte:head>

<Screen title={t("loop.title")} onclose={back}>
  {#if view.s === "request"}
    <h1 class="t-title">{t("loop.ask")}</h1>
    <TextField label={t("loop.label")} bind:value={words} placeholder={t("loop.placeholder")} max={80} error={view.error} />
  {:else if view.s === "readback" && readback}
    <h1 class="t-title">{readback.line}</h1>
    <ul class="chips">{#each readback.chips as c}<li>{c}</li>{/each}</ul>
  {:else if view.s === "finding"}
    <p class="t-muted" role="status">{t("loop.finding")}</p>
  {:else if view.s === "none"}
    <div class="none" role="status">
      <Icon name="bench" size={48} />
      <h1 class="t-title">{view.message}</h1>
    </div>
  {:else if view.s === "loop"}
    <h1 class="t-title">{lines[1]?.text}</h1>
    <article class="card" aria-label={t("loop.cardAria")}>
      <h2>{lines[0]?.text}</h2>
      <ol class="turns">{#each view.loop.turns as turn}<li>{turn.text}</li>{/each}</ol>
      <p class="warn">{t("loop.warn")}</p>
      <p class="t-small">{t("site.foot.osm")}</p>
    </article>
  {/if}
  {#snippet actions()}
    {#if view.s === "request"}
      <Button onclick={check} disabled={!words.trim()}>{t("cond.check")}</Button>
    {:else if view.s === "readback"}
      {@const ask = view.ask}
      <Button onclick={() => make(ask)}>{t("loop.make")}</Button>
      <Button variant="text" onclick={() => (view = { s: "request", error: "" })}>{t("readback.fix")}</Button>
    {:else if view.s === "none"}
      {@const v = view}
      {#if v.next}
        <Button onclick={() => make({ ...v.ask, restGapM: v.next as 200 | 400 })}>{t("loop.try", { m: v.next })}</Button>
      {/if}
      <Button variant="text" onclick={() => (view = { s: "request", error: "" })}>{t("readback.fix")}</Button>
    {:else if view.s === "loop"}
      {@const v = view}
      <Button icon="card" onclick={() => print(v.loop, v.place)}>{t("loop.print")}</Button>
      <Button variant="text" pressed={reading} onclick={() => read(v.loop)}>{reading ? t("loop.stopReading") : t("loop.read")}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  h1, h2, p { margin: 0; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chips li { padding: 6px 12px; border-radius: 999px; background: var(--surface); box-shadow: var(--e-1); font-weight: 700; }
  .none { flex: 1; display: grid; place-items: center; text-align: center; gap: 8px; align-content: center; }
  .card { background: #fff; color: #111; border-radius: 8px; padding: 18px; box-shadow: var(--e-3); display: flex; flex-direction: column; gap: 10px; }
  .card h2 { font-size: 1.5rem; }
  .turns { margin: 0; padding-left: 26px; font-size: 1.25rem; line-height: 1.35; font-weight: 700; display: flex; flex-direction: column; gap: 6px; }
  .warn { font-weight: 700; border-top: 2px solid #111; padding-top: 8px; }
</style>
