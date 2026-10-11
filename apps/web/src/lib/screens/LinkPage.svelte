<!-- The invitee's link page: picks the screen from LinkFlow (flow/link.svelte.ts). Mounted by /g/[id]. -->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { t } from "#lib/copy/index.ts";
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import I0Join from "./I0Join.svelte";
  import I1Invite from "./I1Invite.svelte";
  import I2Condition from "./I2Condition.svelte";
  import I3Readback from "./I3Readback.svelte";
  import I4YoureIn from "./I4YoureIn.svelte";
  import I5NotSuit from "./I5NotSuit.svelte";
  import I6Lit from "./I6Lit.svelte";
  import I7Compass from "./I7Compass.svelte";
  import I8Here from "./I8Here.svelte";
  import I9Ember from "./I9Ember.svelte";
  import I10Gone from "./I10Gone.svelte";
  import I11Spark from "./I11Spark.svelte";
  import I12Outside from "./I12Outside.svelte";
  // Plan screens (P4 to P7) load when the link is a Plan: Flares are most links (JS budget).
  const planScreens = () =>
    Promise.all([import("./P4PlanInvite.svelte"), import("./P5PlanLit.svelte"), import("./P6Fading.svelte"), import("./P7PlanGone.svelte")]);
  import type { Deps } from "./flow/deps.ts";
  import { LinkFlow, rememberedName } from "./flow/link.svelte.ts";
  import { roundMeters, type SensorState, startSensors } from "./flow/compass.ts";
  import { createGuide, type GuideState } from "#lib/compass/guide.ts";
  import { clock } from "./flow/format.ts";
  import { sparkVoiceOn } from "#lib/voice/spark.ts";

  let {
    deps,
    gatheringId,
    fragment,
    bindToken = null,
    area = "fairlane",
    onexit,
  }: { deps: Deps; gatheringId: string; fragment: string | null; bindToken?: string | null; area?: string; onexit?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const flow = new LinkFlow(deps, gatheringId, bindToken);
  let name = $state(rememberedName());
  let condText = $state("");
  let sparkLine = $state("");
  let fadeView = $state<"confirm" | "notice">("confirm");
  let guided = $state<GuideState | null>(null);
  let sensor = $state<SensorState>("asking");
  let talking = $state(true);
  let stopSensors: (() => void) | null = null;

  // ADR-0027: offer "Say it" on the Spark screen when the server has Scribe.
  let canSay = $state(false);
  onMount(() => {
    void sparkVoiceOn().then((v) => (canSay = v));
  });
  onMount(() => {
    void flow.open(fragment).then(() => {
      void flow.loadNeeds();
      void flow.loadPack(area);
      void knownPosition();
    });
  });
  onDestroy(() => {
    stopSensors?.();
    flow.close();
  });

  /** Walk time only when location was already allowed: never a prompt on the invite (SRS-RES-1). */
  async function knownPosition() {
    try {
      const p = await navigator.permissions?.query({ name: "geolocation" });
      if (p?.state !== "granted") return;
      navigator.geolocation.getCurrentPosition((pos) => flow.setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }));
    } catch {
      // No Permissions API: no walk time.
    }
  }

  /** Find them: sensors start inside the tap, orientation first (spike E3). */
  function find() {
    stopSensors?.();
    guided = null;
    stopSensors = startSensors(
      createGuide(flow.target),
      (g) => (guided = g),
      (st) => (sensor = st),
      (p) => flow.setPosition(p),
    );
    flow.find();
  }
  function leaveCompass() {
    stopSensors?.();
    stopSensors = null;
    flow.backToLit();
  }

  const target = $derived(flow.target);
  // The guide (lib/compass/guide.ts) smooths and gates; the screen only shows its answer.
  const meters = $derived(guided?.distance_m != null ? roundMeters(guided.distance_m) : 0);
  const bearing = $derived(guided?.rel_deg ?? 0);
  const status = $derived(
    guided?.distance_m == null ? "no-gps" : guided.near ? "near" : guided.rel_deg === null ? "no-orientation" : guided.facing ? "facing" : "pointing",
  ) as "pointing" | "facing" | "near" | "no-orientation" | "no-gps";
  const compassNote = $derived(
    sensor === "orientation-denied"
      ? t("perm.motion.denied")
      : sensor === "gps-denied"
        ? t("perm.locationFriend.denied")
        : guided?.distance_m == null
          ? t("compass.finding")
          : guided.near
            ? t("compass.apart")
            : guided.hint === "flat"
            ? t("compass.holdFlat")
            : guided.hint === "figure8"
              ? t("compass.figure8")
              : "",
  );

  // "Outside together · N min" on Lit once 2+ have arrived; ticks every 30 s.
  let tick = $state(Date.now());
  $effect(() => {
    const h = setInterval(() => (tick = Date.now()), 30_000);
    return () => clearInterval(h);
  });
  const together = $derived(
    (flow.view?.headcount ?? 0) >= 2 && flow.outsideSince !== null
      ? Math.max(1, Math.round((tick - flow.outsideSince) / 60_000))
      : null,
  );
  const exit = () => (onexit ? onexit() : history.length > 1 ? history.back() : window.close());
  const v = $derived(flow.view);
  const info = $derived(flow.info);
  const host = $derived(info?.host ?? "");
  const plan = $derived(v?.plan ?? null);
  const current = $derived(plan?.current_step ?? 1);
</script>

{#if flow.screen === "loading"}
  {#if flow.error}
    <Screen close={false}>
      <div class="center"><p class="t-title" role="alert">{flow.error}</p></div>
      {#snippet actions()}<Button onclick={() => location.reload()}>{t("err.retry")}</Button>{/snippet}
    </Screen>
  {:else}
    <I1Invite view="loading" />
  {/if}
{:else if flow.screen === "missing-key"}
  <I1Invite view="missing-key" onclose={exit} />
{:else if flow.screen === "gone"}
  {#if v?.kind === "plan"}{#await planScreens() then [, , , { default: P7PlanGone }]}<P7PlanGone ask={info?.words ?? ""} onclose={exit} />{/await}{:else}<I10Gone onclose={exit} />{/if}
{:else if flow.screen === "outside"}
  <I12Outside view={v?.state === "gone" ? "end" : "go"} spot={info?.spot ?? ""} sunset={info?.nature ?? ""} minutes={flow.outsideMin} photo={info?.photo ?? ""} people={info?.host ? [info.host, name || "You"] : []} spark={flow.sparkLine} onclose={exit} />
{:else if flow.screen === "join"}
  <I0Join {host} bind:name error={flow.error} busy={flow.busy} onjoin={(n) => flow.join(n)} onclose={() => flow.notNow()} />
{:else if info && v}
  {#if flow.screen === "invite"}
    <I1Invite view={v.state === "lit" ? "lit" : "kindling"} {info} have={flow.have} quorum={v.quorum} error={flow.error} busy={flow.busy} canCondition={flow.canCondition} onyes={() => flow.yes()} oncondition={() => flow.startCondition()} onclose={exit} />
  {:else if flow.screen === "condition"}
    <I2Condition {info} bind:text={condText} error={flow.condError} oncheck={(x) => flow.check(x)} onclose={() => flow.notNow()} />
  {:else if flow.screen === "readback"}
    <I3Readback {info} line={flow.readBack} chips={flow.chips} busy={flow.busy} onyes={() => flow.confirmReadBack()} onfix={() => flow.fix()} onclose={() => flow.notNow()} />
  {:else if flow.screen === "not-suit"}
    <I5NotSuit {info} reasons={flow.notSuit} busy={flow.busy} onyes={() => flow.closerOne()} onno={() => flow.notNow()} />
  {:else if flow.screen === "in"}
    <I4YoureIn view={flow.takenBack ? "taken-back" : flow.queued ? "queued" : "success"} have={flow.have} quorum={v.quorum} error={flow.error} canTakeBack={flow.me?.can_take_back ?? true} ondone={exit} ontakeback={() => flow.takeBack()} />
  {:else if flow.screen === "lit"}
    <I6Lit view={v.ember_choice ? "smaller" : "lit"} {info} {together} savedAt={flow.savedAt} smallerAt={flow.emberPlace.name} cant={flow.me?.answer === "cant_make_it"} error={flow.error} busy={flow.busy} onfind={find} onhere={() => flow.here()} oncant={() => flow.cantMakeIt()} onclose={exit} />
  {:else if flow.screen === "compass"}
    <I7Compass name={host} {status} {meters} {bearing} live {talking} savedAt={flow.savedAt} note={compassNote} onhere={() => flow.here()} ontalk={(on) => (talking = on)} onclose={leaveCompass} />
  {:else if flow.screen === "here"}
    <I8Here here={flow.hereCount} ondone={() => flow.afterHere()} />
  {:else if flow.screen === "spark"}
    <I11Spark bind:line={sparkLine} {canSay} error={flow.error} busy={flow.busy} onsave={(l) => flow.saveSpark(l)} onskip={() => flow.skipSpark()} />
  {:else if flow.screen === "spark-saved"}
    <I11Spark view="saved" onskip={() => flow.skipSpark()} />
  {:else if flow.screen === "ember"}
    <I9Ember view="waiting" {info} bench={flow.emberPlace.name} meters={flow.emberPlace.meters} have={flow.have} answered={flow.me?.answer === "yes"} error={flow.error} busy={flow.busy} onyes={() => flow.yes()} onfind={find} onclose={exit} />
  {:else if flow.screen === "plan-invite" && plan}
    {#await planScreens() then [{ default: P4PlanInvite }]}<P4PlanInvite {host} ask={info.words} deadline={clock(plan.deadline_at, flow.tz)} steps={flow.steps} have={flow.have} quorum={v.quorum} error={flow.error} busy={flow.busy} canCondition={flow.canCondition} onyes={() => flow.yes()} onshort={() => flow.shortOnly()} oncondition={() => flow.startCondition()} onclose={exit} />{/await}
  {:else if flow.screen === "plan-lit" && plan}
    {#await planScreens() then [, { default: P5PlanLit }]}<P5PlanLit ask={info.words} steps={flow.steps} {current} start={clock(plan.start_at, flow.tz)} smaller={v.state === "ember" || current > 1} canFade={flow.me?.can_fade ?? false} stillComing={flow.me?.still_coming ?? false} savedAt={flow.savedAt} onfind={find} onfade={() => { fadeView = "confirm"; flow.askFade(); }} onclose={exit} />{/await}
  {:else if flow.screen === "fade" && plan}
    {#await planScreens() then [, , { default: P6Fading }]}<P6Fading view={fadeView} ask={info.words} steps={flow.steps} {current} smallGroup={(v.headcount ?? v.quorum) <= 3} error={flow.error} busy={flow.busy} onyes={async () => { if (await flow.fade()) fadeView = "notice"; }} onno={() => flow.backToLit()} onok={() => flow.backToLit()} />{/await}
  {/if}
{/if}

<style>
  .center { flex: 1; display: grid; place-items: center; text-align: center; }
</style>
