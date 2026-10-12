<!-- Try-it demo: a judge alone plays a Flare with three demo friends (backlog #4). The real
     engine on a demo clock (lib/demo/demo.svelte.ts) and the real screens; nothing is sent. -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { t } from "#lib/copy/index.ts";
  import Button from "#lib/components/Button.svelte";
  import H3Send from "#lib/screens/H3Send.svelte";
  import H5HostKindling from "#lib/screens/H5HostKindling.svelte";
  import I6Lit from "#lib/screens/I6Lit.svelte";
  import I7Compass from "#lib/screens/I7Compass.svelte";
  import I11Spark from "#lib/screens/I11Spark.svelte";
  import I1Invite from "#lib/screens/I1Invite.svelte";
  import I2Condition from "#lib/screens/I2Condition.svelte";
  import I4YoureIn from "#lib/screens/I4YoureIn.svelte";
  import I8Here from "#lib/screens/I8Here.svelte";
  import Screen from "#lib/components/Screen.svelte";
  import Flame from "#lib/components/Flame.svelte";
  import { parse, readBackChips } from "#lib/conditions/index.ts";
  import I3Readback from "#lib/screens/I3Readback.svelte";
  import I12Outside from "#lib/screens/I12Outside.svelte";
  import { DEMO_BENCHES, DEMO_FRIENDS, DEMO_HOST, DEMO_SCENE, DEMO_SPOT, DEMO_WORDS, DemoEngine } from "#lib/demo/demo.svelte.ts";
  import type { InviteInfo } from "#lib/components/parts.ts";

  // You are the host. For one beat you become Amor, a friend (fresh-eyes #4), then come back.
  type Step = "send" | "kindling" | "friend" | "condition" | "readback" | "friendIn" | "lit" | "compass" | "here" | "spark" | "outside" | "done";
  const demo = new DemoEngine();
  let step = $state<Step>("send");
  let quorum = $state("4");
  let toast = $state("");
  let bearing = $state(40);
  let litAt = 0;
  let sentAt = $state(0); // the demo clock when you sent it, so "Sent 30 min ago" follows the skip
  let sparkLine = $state("");
  let condition = $state("");
  let condRead = $state(""); // the real parser's read-back, as a friend's phone shows it
  let condError = $state("");
  let condLine = $state("");
  const ctxFor = () => ({
    members: [{ id: DEMO_HOST, name: me }, ...DEMO_FRIENDS.map((f) => ({ id: f.id, name: f.name }))],
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date(demo.now).toISOString(),
    kind: "flare" as const,
    host: me, // "only with you" means the host, as on a real friend's phone
  });
  // The same parser a friend's phone uses (fresh-eyes round 3: "Check it" checked nothing).
  function checkCondition(text: string) {
    const r = parse(text, ctxFor());
    if (!r.ok) {
      condError = r.reason === "not_in_group" ? t("cond.notInGroup", { name: r.name ?? "" }) : r.reason === "too_many" ? t("cond.tooMany") : t("cond.didntCatch");
      return;
    }
    condError = "";
    // The real read-back with Yes / Fix it, as a friend's phone shows it (fresh-eyes round 4).
    condLine = r.readBack;
    condRead = readBackChips(r.rules, ctxFor()).join(", ");
    step = "readback";
  }
  let amorIn = $state(false);
  let typedLine = $state(""); // what you typed for Where you'll be: the demo keeps it (round 2)
  // Friends see the host by first name. In the demo the host is you (fresh-eyes #3).
  let me = $state("Fuego");
  $effect(() => {
    try {
      me = localStorage.getItem("flare.name")?.trim() || "Fuego";
    } catch {}
  });
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  onDestroy(() => timers.forEach(clearTimeout));

  // Fresh-eyes #2: the demo keeps the promise it shows: a count, never a name.
  const say = () => {
    toast = t("demo.said", { n: demo.have() });
    later(2200, () => (toast = ""));
  };
  function send() {
    demo.start(Number(quorum));
    sentAt = demo.now;
    step = "kindling";
  }
  // Amor's yes, given by you on Amor's screen. With 4 needed it stays Kindling until you skip ahead.
  function amorYes() {
    demo.yes(DEMO_FRIENDS[0].id);
    amorIn = true;
    step = "friendIn";
  }
  function backToYou() {
    step = "kindling";
    // Say whose screen this is again (fresh-eyes round 3), with the count, never a name.
    later(400, () => {
      toast = t("demo.back", { host: me, n: demo.have() });
      later(3000, () => (toast = ""));
    });
    if (demo.g?.state === "lit") toLit();
  }
  function skip() {
    demo.advance(30 * 60_000 + 1000); // the real 30-minute Ember rule
    // Amor's phone checks both benches; Benny says yes to the smaller plan.
    demo.event({ type: "checks", member_id: DEMO_FRIENDS[0].id, results: { c1: true, c2: true } });
    later(700, () => {
      // The smaller plan needs fewer people. If the yeses already in are enough, it lights with
      // them; only if not does Benny's yes come in, shown as a count (fresh-eyes round 4).
      demo.advance(61_000);
      if (demo.g?.state !== "lit") {
        demo.yes(DEMO_FRIENDS[1].id);
        demo.advance(61_000);
        say();
      }
      if (demo.g?.state === "lit") toLit();
    });
  }
  function toLit() {
    litAt = demo.now;
    step = "lit";
  }
  function compass() {
    step = "compass";
    // A friend turning toward the spot: the bearing eases to straight ahead.
    const sweep = () => {
      bearing = Math.round(bearing * 0.8);
      if (Math.abs(bearing) > 2 && step === "compass") later(400, sweep);
    };
    later(600, sweep);
  }
  function here() {
    demo.event({ type: "arrival", by: DEMO_FRIENDS[0].id, who: { for: "self" }, recorded_at: new Date(demo.now).toISOString() });
    step = "here"; // the meetup itself, before the reflection (fresh-eyes #9)
  }
  function outside() {
    demo.advance(15 * 60_000); // the 15-minute smaller plan, then the host ends it (fresh-eyes #8)
    demo.event({ type: "done", by: "00000000-0000-4000-8000-0000000000a0" });
    step = "outside";
  }

  // Once it is an Ember, name the bench it will pick from the start, so the place never changes
  // under you a second later (fresh-eyes #8). Both benches check out, so the engine takes c1.
  const bench = $derived(
    demo.g?.ember_choice
      ? (DEMO_BENCHES[demo.g.ember_choice] ?? DEMO_SPOT)
      : demo.g?.state === "ember"
        ? (DEMO_BENCHES.c1 as string)
        : DEMO_SPOT,
  );
  const info: InviteInfo = $derived({
    host: me,
    words: DEMO_WORDS,
    scene: DEMO_SCENE,
    photo: "/demo/pond.jpg",
    spot: bench,
    hostLine: typedLine || t("demo.youWait", { spot: bench }),
    walkMin: 2, // about the compass's 150 m (round 2: numbers that agree)
    access: { benches: { count: 2, nearest_m: 0 }, restrooms: { count: 1, nearest_m: 180 }, water: { count: 0, nearest_m: null }, steps_mapped: false },
    nature: "",
    met: null,
  } as InviteInfo);
  const minutes = $derived(litAt ? Math.round((demo.now - litAt) / 60_000) : 15);
  // Opened straight from a link there is no page to go back to (fresh-eyes #9).
  const leave = () => {
    const fromHere = (() => {
      try {
        return !!document.referrer && new URL(document.referrer).origin === location.origin;
      } catch {
        return false;
      }
    })();
    if (fromHere) history.back();
    else location.href = "/";
  };
</script>

<svelte:head><title>{t("demo.badge")}</title><link rel="preload" as="image" href="/demo/pond.jpg" /></svelte:head>

<div class="demo" class:coach={step === "kindling" && !!demo.g && demo.g.state !== "lit"}>
  <!-- The demo's own notes sit in a labelled landmark of their own (axe: region). -->
  <aside class="notes" aria-label={t("demo.badge")}>
    <p class="badge" role="status">{t("demo.badge")}</p>
    <!-- Whose screen this is, all the way through (fresh-eyes round 5). -->
    <!-- A way out on every step, also where the screen itself has no X (fresh-eyes round 5). -->
    {#if ["friendIn", "here", "spark", "outside", "done"].includes(step)}<button class="out" aria-label={t("demo.leave")} onclick={leave}>✕</button>{/if}
    {#if step !== "send" && step !== "done"}<p class="who">{["friend", "condition", "readback", "friendIn"].includes(step) ? t("demo.youFriend") : t("demo.youHost", { host: me })}</p>{/if}
    {#if toast}<p class="toast" role="status">{toast}</p>{/if}
  </aside>

  {#if step === "send"}
    <H3Send coach={t("demo.intro", { host: me })} bind:hostLine={typedLine} words={DEMO_WORDS} photo="/demo/pond.jpg" scene={DEMO_SCENE} spot={DEMO_SPOT} bind:quorum onsend={send} onclose={leave} />
  {:else if step === "kindling"}
    <div class="layer">
      <H5HostKindling photo="/demo/pond.jpg" scene={DEMO_SCENE} view={demo.have() > 1 ? "growing" : "zero"} have={demo.have()} quorum={demo.g?.quorum ?? 4} sentMin={sentAt ? Math.floor((demo.now - sentAt) / 60_000) : 0} hostLine={typedLine || t("demo.youWait", { spot: DEMO_SPOT })} onclose={leave} />
      {#if demo.g?.state === "kindling" && !amorIn}
        <div class="control"><p>{t("demo.friendCoach")}</p><Button onclick={() => (step = "friend")}>{t("demo.asFriend")}</Button></div>
      {:else if demo.g?.state === "kindling" && demo.have() > 1}
        <div class="control"><p>{t("demo.shrinkHint")}</p><Button onclick={skip}>{t("demo.skip")}</Button></div>
      {:else if demo.g?.state === "ember"}
        <div class="control"><p>{t("ember.headline", { bench })}</p></div>
      {/if}
    </div>
  {:else if step === "friend"}
    <aside class="notes" aria-label={t("demo.friendBanner", { host: me })}><p class="role" role="status">{t("demo.friendBanner", { host: me })}</p></aside>
    <I1Invite info={{ ...info, spot: DEMO_SPOT, hostLine: "" }} have={demo.have()} quorum={demo.g?.quorum ?? 4} onyes={amorYes} oncondition={() => (step = "condition")} onclose={() => (step = "kindling")} />
  {:else if step === "condition"}
    <aside class="notes" aria-label={t("demo.friendBanner", { host: me })}><p class="role" role="status">{t("demo.friendBanner", { host: me })}</p></aside>
    <I2Condition {info} bind:text={condition} error={condError} oncheck={checkCondition} onclose={() => (step = "friend")} />
  {:else if step === "readback"}
    <aside class="notes" aria-label={t("demo.friendBanner", { host: me })}><p class="role" role="status">{t("demo.friendBanner", { host: me })}</p></aside>
    <I3Readback {info} line={condLine} chips={condRead.split(", ").filter(Boolean)} onyes={amorYes} onfix={() => (step = "condition")} onclose={() => (step = "friend")} />
  {:else if step === "friendIn"}
    <aside class="notes" aria-label={condRead ? t("demo.inIf", { rule: condRead }) : t("demo.friendBanner", { host: me })}><p class="role" role="status">{condRead ? t("demo.inIf", { rule: condRead }) : t("demo.friendBanner", { host: me })}</p></aside>
    <I4YoureIn doneLabel={t("demo.backToYou")} have={demo.have()} quorum={demo.g?.quorum ?? 4} canTakeBack={false} ondone={backToYou} />
  {:else if step === "lit"}
    {#if demo.g?.ember_choice}<aside class="notes" aria-label={t("demo.coachLit")}><p class="role coach-low" role="status">{t("demo.coachLit")}</p></aside>{/if}
    <div class="layer">
      <I6Lit view={demo.g?.ember_choice ? "smaller" : "lit"} {info} smallerAt={bench} onfind={compass} onhere={here} onclose={leave} />
    </div>
  {:else if step === "compass"}
    <aside class="notes" aria-label={t("demo.coachFind")}><p class="role coach-low" role="status">{t("demo.coachFind")}</p></aside>
    <I7Compass name={bench.charAt(0).toUpperCase() + bench.slice(1)} status={Math.abs(bearing) <= 15 ? "facing" : "pointing"} meters={150} {bearing} onhere={here} onclose={() => (step = "lit")} />
  {:else if step === "here"}
    <I8Here doneLabel={t("demo.next")} here={demo.have()} ondone={() => (step = "spark")} />
  {:else if step === "spark"}
    <I11Spark onsave={(l) => { sparkLine = l; outside(); }} onskip={outside} />
  {:else if step === "outside"}
    <I12Outside view="end" {minutes} photo="/demo/pond.jpg" people={[me === "Fuego" ? t("demo.you") : me, "Amor", "Benny"].slice(0, demo.have())} spark={sparkLine} onclose={() => (step = "done")} />
  {:else}
    <Screen theme="dark" close={false} heading={t("demo.done")}>
      <div class="done"><Flame state="lit" size={110} /><h1 class="t-display">{t("demo.done")}</h1></div>
      {#snippet actions()}
        <Button
          onclick={() => {
            try {
              localStorage.setItem("flare.onboarded", "1"); // the demo was the intro
            } catch {}
            location.href = "/app/";
          }}>{t("demo.real")}</Button>
        <Button variant="text" onclick={() => location.reload()}>{t("demo.again")}</Button>
      {/snippet}
    </Screen>
  {/if}
</div>

<style>
  .demo { position: fixed; inset: 0; }
  /* The badge sits in the header's title slot (fix 1): hide the screen title under it. */
  .demo :global(.bar-title) { visibility: hidden; }
  /* While the coach shows, it replaces the action row (fix 5). */
  .demo.coach :global(.actions) { display: none; } /* out of the page, not only out of sight */
  .layer { position: absolute; inset: 0; }
  .notes { display: contents; }
  .out { position: fixed; top: calc(env(safe-area-inset-top, 0) + 10px); right: 12px; z-index: 31; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgb(0 0 0 / 0.45); color: #fff; font-size: 1.1rem; }
  .who { position: fixed; top: calc(env(safe-area-inset-top, 0) + 52px); left: 50%; transform: translateX(-50%); white-space: nowrap; z-index: 30; margin: 0; padding: 6px 12px; border-radius: 999px; background: rgb(0 0 0 / 0.55); color: #fff; font-weight: 700; font-size: 0.8125rem; }
  .coach-low { top: auto !important; bottom: calc(env(safe-area-inset-bottom, 0) + 150px); }
  .badge { position: fixed; top: calc(env(safe-area-inset-top, 0) + 14px); left: 50%; transform: translateX(-50%); z-index: 30; white-space: nowrap; margin: 0;
    padding: 6px 14px; border-radius: 999px; background: #fff; color: #111; font-weight: 700; font-size: 0.875rem; box-shadow: 0 2px 10px rgb(0 0 0 / 0.25); }
  .toast { position: fixed; top: calc(env(safe-area-inset-top, 0) + 92px); left: 50%; transform: translateX(-50%); z-index: 30; margin: 0;
    padding: 10px 18px; border-radius: 999px; background: var(--c-gold-400); color: #111; font-weight: 700; }
  .control { position: absolute; left: 0; right: 0; bottom: 0; z-index: 25; border-radius: 28px 28px 0 0 !important; padding-bottom: calc(24px + env(safe-area-inset-bottom, 0)) !important; display: flex; flex-direction: column; gap: 8px; align-items: stretch;
    padding: 14px; border-radius: 20px; background: rgb(255 255 255 / 0.94); color: #111; box-shadow: 0 8px 30px rgb(0 0 0 / 0.3); }
  .control p { margin: 0; font-weight: 600; }
  .role { position: fixed; top: calc(env(safe-area-inset-top, 0) + 92px); left: 50%; transform: translateX(-50%); z-index: 30; margin: 0; width: max-content; max-width: calc(100% - 32px); text-align: center;
    padding: 8px 16px; border-radius: 999px; background: #111; color: #fff; font-weight: 700; font-size: 0.9375rem; }
  .done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
  .done h1 { margin: 0; }
</style>
