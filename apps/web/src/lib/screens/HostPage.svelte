<!-- The host app at /app/: camera first (SRS-CRE-1), then develop, send, share and the host controls. Picks screens from HostFlow. -->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { t, type CopyKey } from "#lib/copy/index.ts";
  import { toJpeg768 } from "#lib/photo.ts";
  import { askCamera, askLocation, permissionState } from "#lib/permissions/index.ts";
  import Sheet from "../components/Sheet.svelte";
  import Icon from "../components/Icon.svelte";
  import H1Camera from "./H1Camera.svelte";
  import H2Develop from "./H2Develop.svelte";
  import H3Send from "./H3Send.svelte";
  import H4Sent from "./H4Sent.svelte";
  import H5HostKindling from "./H5HostKindling.svelte";
  import H6HostLit from "./H6HostLit.svelte";
  import I10Gone from "./I10Gone.svelte";
  import I12Outside from "./I12Outside.svelte";
  import P1PlanAsk from "./P1PlanAsk.svelte";
  import P2Ladder from "./P2Ladder.svelte";
  import type { Deps } from "./flow/deps.ts";
  import { clock } from "./flow/format.ts";
  import { HostFlow } from "./flow/host.svelte.ts";

  let { deps, area = "fairlane" }: { deps: Deps; area?: string } = $props();
  // svelte-ignore state_referenced_locally
  const flow = new HostFlow(deps);

  let camera = $state<"live" | "permission" | "denied" | "loading">("loading");
  let stream = $state<MediaStream | null>(null);
  let own = $state("");
  let typedSpot = $state("");
  let menu = $state(false);
  let kind = $state<"flare" | "plan">("flare");
  let startLocal = $state("");
  let deadlineLocal = $state("");

  onMount(() => {
    void flow.loadGroup();
    void flow.loadPack(area);
    void (async () => {
      const cam = await permissionState("camera");
      if (cam === "granted") await openCamera();
      else camera = "permission";
      if ((await permissionState("geolocation")) === "granted") void locate();
    })();
  });
  onDestroy(() => {
    stopCamera();
    flow.close();
  });

  async function openCamera() {
    camera = "loading";
    const r = await askCamera();
    if (r.ok) {
      stream = r.stream;
      camera = "live";
    } else camera = r.reason === "denied" ? "denied" : "live"; // no camera API: the shutter opens the picker
  }
  function stopCamera() {
    for (const tr of stream?.getTracks() ?? []) tr.stop();
    stream = null;
  }

  async function shoot(video: HTMLVideoElement | null) {
    if (!video || !video.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    stopCamera();
    await flow.usePhoto(await toJpeg768(blob));
  }
  async function pick(file: File) {
    stopCamera();
    await flow.usePhoto(await toJpeg768(file));
  }

  async function locate() {
    const r = await askLocation({ timeoutMs: 15_000, highAccuracy: true });
    if (r.ok) flow.setPosition({ lat: r.coords.lat, lon: r.coords.lon });
    else flow.typeSpot(typedSpot);
  }

  async function send() {
    const ok = await flow.send(kind);
    if (ok) void flow.share(); // the share sheet opens on its own (H4); still inside the tap's activation on most browsers
  }

  // Plans: datetime-local values in this phone's zone.
  const toLocal = (ms: number) => {
    const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
    return d.toISOString().slice(0, 16);
  };
  function startPlan() {
    menu = false;
    kind = "plan";
    flow.startPlan();
    startLocal = flow.startAt ? toLocal(flow.startAt) : "";
    deadlineLocal = flow.deadlineAt ? toLocal(flow.deadlineAt) : "";
  }
  $effect(() => {
    if (kind !== "plan") return;
    flow.startAt = startLocal ? Date.parse(startLocal) : null;
    flow.deadlineAt = deadlineLocal ? Date.parse(deadlineLocal) : null;
  });
  const planError = $derived(kind === "plan" && (startLocal || deadlineLocal) ? flow.planError() : "");

  const items: [string, CopyKey, CopyKey, string][] = [
    ["plan", "menu.plan", "menu.planSub", "#plan"],
    ["hotspots", "menu.hot", "menu.hotSub", "/app/hotspots/"],
    ["bench", "menu.needs", "menu.needsSub", "/app/needs/"],
    ["card", "menu.loop", "menu.loopSub", "/app/loop/"],
    ["mapfix", "menu.map", "menu.mapSub", "/app/fix-map/"],
    ["info", "menu.check", "menu.checkSub", "/check/"],
    ["spark", "menu.ai", "menu.aiSub", "/ai/"],
    ["close", "menu.forget", "menu.forgetSub", "/app/forget/"],
  ];
  const exit = () => location.assign("/app/");
</script>

{#if flow.screen === "camera"}
  <H1Camera view={camera} {stream} onshoot={shoot} onpick={pick} onallow={openCamera} onmenu={() => (menu = true)} />
{:else if flow.screen === "develop"}
  <H2Develop view={flow.draft} photo={flow.photo} scene={flow.alt} spot={flow.spot?.name ?? ""} words={flow.words} tier={flow.tier} chips={flow.chips} bind:own askLocation={flow.askLocation} bind:typedSpot onuse={(w) => flow.useWords(w)} onwrite={() => (flow.draft = "hub-unreachable")} onallowlocation={locate} onskiplocation={() => flow.typeSpot(typedSpot)} />
{:else if flow.screen === "send"}
  <H3Send view={flow.sending ? "sending" : flow.error ? "error" : "ready"} photo={flow.photo} scene={flow.alt} words={flow.words} spot={flow.spot?.name ?? ""} bind:quorum={flow.quorum} bind:hostLine={flow.hostLine} bind:hostName={flow.hostName} askName={flow.askName} access={flow.access} nature={flow.nature} error={flow.error} onsend={send} onclose={exit} />
{:else if flow.screen === "sent"}
  <H4Sent kind={flow.view?.kind ?? kind} deadline={flow.deadlineAt ? clock(flow.deadlineAt, flow.tz) : ""} copied={flow.copied} ondone={() => flow.pocket()} onshare={() => flow.share()} oncopy={() => flow.copyText()} />
{:else if flow.screen === "kindling"}
  <H5HostKindling have={flow.have} quorum={flow.view?.quorum ?? 2} sentMin={flow.sentMin} shrinkMin={flow.shrinkMin} hostLine={flow.hostLine} code={flow.view?.short_code ?? ""} textYesUsed={flow.textYesUsed} error={flow.error} busy={flow.busy} ontextyes={(c) => flow.textYes(c)} oncancel={() => flow.cancel()} onshare={() => flow.share()} onclose={exit} />
{:else if flow.screen === "lit"}
  <H6HostLit coming={Math.max(0, flow.have - 1)} spot={flow.spot?.name ?? ""} here={flow.view?.headcount ?? 0} members={flow.members} marked={flow.marked} error={flow.error} busy={flow.busy} onplusone={(w) => flow.plusOne(w)} ondone={() => flow.done()} onclose={exit} />
{:else if flow.screen === "outside"}
  <I12Outside view="end" sunset={flow.nature} onclose={exit} />
{:else if flow.screen === "gone"}
  <I10Gone onclose={exit} />
{:else if flow.screen === "plan-ask"}
  <P1PlanAsk bind:ask={flow.ask} bind:quorum={flow.quorum} bind:start={startLocal} bind:deadline={deadlineLocal} error={planError} offline={!navigator.onLine} ondraft={() => flow.draftLadder()} onclose={exit} />
{:else if flow.screen === "plan-ladder"}
  <P2Ladder ask={flow.ask} bind:steps={flow.steps} tier={flow.ladderTier} drafting={flow.steps.length === 0} error={flow.ladderError() || flow.error} sending={flow.sending} onsend={send} onclose={exit} />
{/if}

<Sheet bind:open={menu} title={t("menu.title")}>
  <ul class="menu">
    {#each items as [icon, label, sub, href] (label)}
      <li>
        {#if href === "#plan"}
          <button class="row" onclick={startPlan}><Icon name={icon} /><span class="txt"><b>{t(label)}</b><span class="visually-hidden">{t("app.pause")}</span><span class="t-small t-muted">{t(sub)}</span></span><Icon name="chevron" size={20} /></button>
        {:else}
          <a class="row" {href}><Icon name={icon} /><span class="txt"><b>{t(label)}</b><span class="visually-hidden">{t("app.pause")}</span><span class="t-small t-muted">{t(sub)}</span></span><Icon name="chevron" size={20} /></a>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="t-small t-muted foot">{t("menu.foot")}</p>
</Sheet>

<style>
  .menu { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .row { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px 6px; border: 0; background: transparent; color: var(--text); text-decoration: none; font: inherit; text-align: left; border-radius: var(--r-md); }
  .txt { flex: 1; display: flex; flex-direction: column; }
  .foot { margin: 0; }
</style>
