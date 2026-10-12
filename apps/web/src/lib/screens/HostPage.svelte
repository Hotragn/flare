<!-- The host app at /app/: camera first (SRS-CRE-1), then develop, send, share and the host controls. Picks screens from HostFlow. -->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { t, type CopyKey } from "#lib/copy/index.ts";
  import { toJpeg768 } from "#lib/photo.ts";
  import { askCamera, askLocation, permissionState } from "#lib/permissions/index.ts";
  import Sheet from "../components/Sheet.svelte";
  import Icon from "../components/Icon.svelte";
  import H0Home from "./H0Home.svelte";
  import H1Camera from "./H1Camera.svelte";
  import { golden, nearestGreen } from "./flow/home.ts";
  import { planWeather } from "#lib/map/weather.ts";
  import type { LatLon, MapPack } from "@flare/shared/icd/map";
  import H2Develop from "./H2Develop.svelte";
  import H3Send from "./H3Send.svelte";
  import H4Sent from "./H4Sent.svelte";
  import H5HostKindling from "./H5HostKindling.svelte";
  import H6HostLit from "./H6HostLit.svelte";
  // End screens load when reached (JS budget): the Flare has run 30 min or more by then.
  const endScreens = () => Promise.all([import("./I12Outside.svelte"), import("./I10Gone.svelte")]);
  // The Plan flow (P1, P2) is the second way in: loaded when you start a Plan (JS budget).
  const planScreens = () => Promise.all([import("./P1PlanAsk.svelte"), import("./P2Ladder.svelte")]);
  import type { Deps } from "./flow/deps.ts";
  import { clock } from "./flow/format.ts";
  import { HostFlow } from "./flow/host.svelte.ts";
  import { buzzMode, installed, pushLive, showState } from "#lib/push/buzz.ts";
  import { play } from "#lib/motion/sound.ts";

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
  // H0 Home first (2026 direction, B): going outside now, then Light a Flare opens the camera.
  let home = $state(true);
  // First run: onboarding once (flare.onboarded), then Home.
  const seen = (() => {
    try {
      return localStorage.getItem("flare.onboarded") === "1";
    } catch {
      return true;
    }
  })();
  let onboarding = $state(!seen);
  const finishOnboarding = () => {
    onboarding = false;
    try {
      localStorage.setItem("flare.onboarded", "1");
    } catch {
      // private mode: shown again next time
    }
  };
  // Fresh-eyes #1: once the flow moves past the camera, onboarding is done and never shows behind Send.
  $effect(() => {
    if (onboarding && (flow.screen !== "camera" || !home)) finishOnboarding();
  });
  // Round 6: after a reload, Home offers the live Flare and its link ("Your Flare").
  let liveSaved = $state(false);
  onMount(() => (liveSaved = flow.hasLive()));

  // Live bug 5: say only what this device will do, and catch the host up when they come back.
  let pushOn = $state(false);
  let backNote = $state("");
  let awayState = "";
  onMount(() => {
    void pushLive().then((v) => (pushOn = v));
    const vis = () => {
      if (document.visibilityState === "hidden") {
        awayState = flow.view?.state ?? "";
        return;
      }
      void pushLive().then((v) => (pushOn = v));
      // The live layer refreshes on visible; give it a moment, then say what changed while away.
      setTimeout(() => {
        const v = flow.view;
        if (v && awayState && awayState !== "lit" && v.state === "lit") {
          backNote = t("sent.backLit", { n: Math.max(1, flow.have - 1) });
          play("lit");
          setTimeout(() => (backNote = ""), 6000);
        }
        awayState = "";
      }, 800);
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  });
  $effect(() => {
    const st = flow.view?.state;
    if (!st || home) return;
    const lit = st === "lit";
    showState(lit, st === "gone" ? "Flare" : t(lit ? "sent.titleLit" : "sent.titleWaiting"));
  });

  // Back from the demo, a page restored from the back/forward cache can bring old layers with
  // it; start clean instead.
  onMount(() => {
    const restored = (e: PageTransitionEvent) => e.persisted && location.reload();
    addEventListener("pageshow", restored);
    return () => removeEventListener("pageshow", restored);
  });
  let homeAt = $state<LatLon | null>(null);
  let homePack = $state<MapPack | null>(null);
  let weather = $state<{ temp_f: number; rain_likely: boolean } | null>(null);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const goldenNow = $derived(homeAt ? golden(homeAt, new Date()) : null);
  const green = $derived(homeAt && homePack ? nearestGreen(homePack, homeAt, new Date(), tz) : null);
  async function nearHere() {
    const r = await askLocation({ timeoutMs: 10_000 });
    if (!r.ok) return;
    homeAt = { lat: r.coords.lat, lon: r.coords.lon };
    const now = new Date();
    weather = await planWeather(homeAt, now, new Date(now.getTime() + 2 * 3_600_000)).catch(() => null);
    flow.rainLikely = !!weather?.rain_likely;
  }
  function light() {
    home = false;
    void openCamera(); // inside the tap: the camera prompt can show
  }
  let deadlineLocal = $state("");

  onMount(() => {
    void flow.loadGroup();
    void flow.loadPack(area);
    void deps.maps?.load(area).then(
      (p) => (homePack = p),
      () => {},
    );
    void (async () => {
      const cam = await permissionState("camera");
      camera = cam === "granted" ? "loading" : "permission";
      if ((await permissionState("geolocation")) === "granted") {
        void locate();
        void nearHere(); // already allowed: no prompt
      }
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
    if (!video) return;
    // A tap in the first frames, before the stream has a size, waits for it (up to 3 s) instead of doing nothing.
    if (!video.videoWidth)
      await new Promise<void>((r) => {
        const done = () => r();
        video.addEventListener("loadeddata", done, { once: true });
        setTimeout(done, 3000);
      });
    if (!video.videoWidth) return;
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
    if (!flow.spot?.name && typedSpot.trim()) flow.typeSpot(typedSpot);
    await flow.send(kind);
    // No share sheet here: Send awaits the seal and the POST, and iOS drops the tap by then, so the
    // sheet would fail with nothing on screen. H4's Share is the next tap, with the link ready.
    // Linked to Telegram, the server already posted the card to the group (automations, ADR-0030).
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
    ["plusone", "menu.crew", "menu.crewSub", "/app/crew/"],
    ["hotspots", "menu.hot", "menu.hotSub", "/app/hotspots/"],
    ["share", "menu.tg", "menu.tgSub", "/app/telegram/"],
    ["bench", "menu.needs", "menu.needsSub", "/app/needs/"],
    ["card", "menu.loop", "menu.loopSub", "/app/loop/"],
    ["mapfix", "menu.map", "menu.mapSub", "/app/fix-map/"],
    ["info", "menu.check", "menu.checkSub", "/check/"],
    ["spark", "menu.ai", "menu.aiSub", "/ai/"],
    ["close", "menu.forget", "menu.forgetSub", "/app/forget/"],
  ];
  // A first visit with no crew yet sees 5 items, not 10: the crew pages and the device check
  // wait until there is a crew (fresh-eyes round 4).
  const CREW_ONLY = new Set(["/app/crew/", "/app/hotspots/", "/app/telegram/", "/app/forget/", "/check/"]);
  const shownItems = $derived(flow.groupId ? items : items.filter(([, , , href]) => !CREW_ONLY.has(href)));
  /** Group pages take the group id as `?g=` (Hot spots, Post in Telegram, Forget). */
  const GROUP_PAGES = new Set(["/app/crew/", "/app/hotspots/", "/app/telegram/", "/app/forget/"]);
  const withGroup = (href: string) => (flow.groupId && GROUP_PAGES.has(href) ? `${href}?g=${flow.groupId}` : href);
  const exit = () => location.assign("/app/");
</script>

{#if onboarding && home && flow.screen === "camera"}
  <!-- First run only, so it loads on demand and stays out of the /app budget. -->
  {#await import("./H00Onboarding.svelte") then { default: H00Onboarding }}
    <H00Onboarding onlight={() => { finishOnboarding(); light(); }} ondemo={() => { finishOnboarding(); location.assign("/app/demo/"); }} />
  {/await}
{:else if home && flow.screen === "camera"}
  <H0Home at={homeAt} onlive={liveSaved ? () => { if (flow.resume()) home = false; } : undefined} onagain={flow.groupId ? () => { home = false; flow.startAgain(); } : undefined} golden={goldenNow} {weather} {green} located={!!homeAt} onlight={light} onplan={startPlan} onnear={nearHere} onmenu={() => (menu = true)} />
{:else if flow.screen === "camera"}
  <H1Camera view={camera} {stream} onshoot={shoot} onpick={pick} onallow={openCamera} onmenu={() => (menu = true)} onvoice={(d) => { stopCamera(); flow.useVoice(d); }} />
{:else if flow.screen === "develop"}
  <H2Develop view={flow.draft} photo={flow.photo} scene={flow.alt} spot={flow.spot?.name ?? ""} words={flow.words} tier={flow.tier} cloud={flow.cloudOptIn} onaskcloud={() => flow.askCloud()} chips={flow.chips} bind:own askLocation={flow.askLocation} bind:typedSpot onuse={(w) => flow.useWords(w)} onwrite={() => (flow.draft = "hub-unreachable")} onallowlocation={locate} onskiplocation={() => flow.typeSpot(typedSpot)} />
{:else if flow.screen === "send"}
  <H3Send view={flow.sending ? "sending" : flow.error ? "error" : "ready"} photo={flow.photo} scene={flow.alt} words={flow.words} spot={flow.spot?.name ?? ""} bind:quorum={flow.quorum} bind:hostLine={flow.hostLine} bind:hostName={flow.hostName} askName={flow.askName} askSpot={!flow.spot?.name} bind:typedSpot access={flow.access} nature={flow.nature} error={flow.error} onsend={send} onclose={exit} />
{:else if flow.screen === "sent"}
  <H4Sent buzz={buzzMode({ push: pushOn, telegram: flow.postedToTelegram })} installed={installed()} kind={flow.view?.kind ?? kind} deadline={flow.deadlineAt ? clock(flow.deadlineAt, flow.tz) : ""} copied={flow.copied} linkOnly={flow.linkOnly} shareFirst={!flow.postedToTelegram} ondone={() => flow.pocket()} onshare={() => flow.share()} oncopy={() => flow.copyText()} />
{:else if flow.screen === "kindling"}
  <H5HostKindling photo={flow.photo} scene={flow.alt} have={flow.have} quorum={flow.view?.quorum ?? 2} sentMin={flow.sentMin} shrinkMin={flow.shrinkMin} hostLine={flow.hostLine} code={flow.view?.short_code ?? ""} textYesUsed={flow.textYesUsed} error={flow.error} busy={flow.busy} ontextyes={(c) => flow.textYes(c)} oncancel={() => flow.cancel()} onshare={() => flow.share()} linkOnly={flow.linkOnly} ember={flow.view?.state === "ember"} onclose={exit} />
{:else if flow.screen === "lit"}
  <H6HostLit ontell={() => void flow.shareLit()} linkOnly={flow.linkOnly} coming={Math.max(0, flow.have - 1)} spot={flow.spot?.name ?? ""} here={flow.view?.headcount ?? 0} members={flow.members} marked={flow.marked} error={flow.error} busy={flow.busy} onplusone={(w) => flow.plusOne(w)} ondone={() => flow.done()} onclose={exit} />
{:else if flow.screen === "outside"}
  {#await endScreens() then [{ default: I12Outside }]}
    <I12Outside view="end" sunset={flow.nature} minutes={flow.outsideMin} photo={flow.photo} onclose={exit} />
  {/await}
{:else if flow.screen === "gone"}
  {#await endScreens() then [, { default: I10Gone }]}<I10Gone onclose={exit} />{/await}
{:else if flow.screen === "plan-ask"}
  {#await planScreens() then [{ default: P1PlanAsk }]}
    <P1PlanAsk bind:ask={flow.ask} bind:quorum={flow.quorum} bind:start={startLocal} bind:deadline={deadlineLocal} error={planError} offline={!navigator.onLine} ondraft={() => flow.draftLadder()} onclose={exit} />
  {/await}
{:else if flow.screen === "plan-ladder"}
  {#await planScreens() then [, { default: P2Ladder }]}
    <P2Ladder ask={flow.ask} askName={flow.askName} bind:hostName={flow.hostName} bind:steps={flow.steps} tier={flow.ladderTier} drafting={flow.steps.length === 0} error={flow.ladderError() || flow.error} sending={flow.sending} onsend={send} onclose={exit} />
  {/await}
{/if}

<Sheet bind:open={menu} title={t("menu.title")}>
  <ul class="menu">
    {#each shownItems as [icon, label, sub, href] (label)}
      <li>
        {#if href === "#plan"}
          <button class="row" onclick={startPlan}><Icon name={icon} /><span class="txt"><b>{t(label)}</b><span class="visually-hidden">{t("app.pause")}</span><span class="t-small t-muted">{t(sub)}</span></span><Icon name="chevron" size={20} /></button>
        {:else}
          <a class="row" href={withGroup(href)}><Icon name={icon} /><span class="txt"><b>{t(label)}</b><span class="visually-hidden">{t("app.pause")}</span><span class="t-small t-muted">{t(sub)}</span></span><Icon name="chevron" size={20} /></a>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="t-small t-muted foot">{t("menu.foot")}</p>
</Sheet>

{#if backNote}<p class="posted" role="status">{backNote}</p>{/if}
{#if flow.screen === "sent" && flow.postedToTelegram}
  <p class="posted" role="status">{t("sent.telegram")}</p>
{/if}
<p class="toast" role="status">{flow.note}</p>

<!-- Remember this (ADR-0031): the host turns it on; the recording sign shows here too. -->
{#if (flow.screen === "kindling" || flow.screen === "lit") && flow.rememberCtx()}
  {#await import("#lib/components/RememberPanel.svelte") then { default: RememberPanel }}
    <RememberPanel ctx={flow.rememberCtx() as NonNullable<ReturnType<typeof flow.rememberCtx>>} lit={flow.screen === "lit"} />
  {/await}
{/if}

<style>
  .posted { position: fixed; z-index: 45; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top, 0) + 64px); margin: 0; padding: 10px 16px; border-radius: 999px; background: #1d6fa5; color: #fff; font-weight: 700; white-space: nowrap; }
  .menu { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .row { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px 6px; border: 0; background: transparent; color: var(--text); text-decoration: none; font: inherit; text-align: left; border-radius: var(--r-md); }
  .txt { flex: 1; display: flex; flex-direction: column; }
  .foot { margin: 0; }
  .toast { position: fixed; top: calc(env(safe-area-inset-top, 0) + 72px); left: 16px; right: 16px; z-index: 30; margin: 0 auto; width: fit-content; max-width: 100%; overflow-wrap: anywhere;
    padding: 10px 18px; border-radius: 20px; background: var(--c-gold-400); color: #111; font-weight: 700; }
  .toast:empty { display: none; }
</style>
