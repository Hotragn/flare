<!-- Motion catalog (/dev/components/?s=H5): one app screen at phone size with sample data, so the motion
     moments can be screenshotted, traced and recorded. ?s=H5 picks the screen; ?photo=0 drops
     the photo so the illustrated scene shows; ?hour=21 fixes the sky's hour; ?rain=1, ?wind=25.
     Scripts change props with window.flareDev.set({ have: 3 }). Sample data only (#lib/sample.ts). -->
<script lang="ts">
  import { onMount, type Component } from "svelte";
  import PhoneFrame from "#lib/components/PhoneFrame.svelte";
  import Screen from "#lib/components/Screen.svelte";
  import Scenery from "#lib/components/Scenery.svelte";
  import { access, flare, people } from "#lib/sample.ts";
  import type { InviteInfo } from "#lib/components/parts.ts";

  // biome-ignore lint/suspicious/noExplicitAny: each screen takes its own props.
  type Any = Component<any>;
  const load: Record<string, () => Promise<{ default: Any }>> = {
    H0: () => import("#lib/screens/H0Home.svelte"),
    H5: () => import("#lib/screens/H5HostKindling.svelte"),
    H6: () => import("#lib/screens/H6HostLit.svelte"),
    I1: () => import("#lib/screens/I1Invite.svelte"),
    I6: () => import("#lib/screens/I6Lit.svelte"),
    I9: () => import("#lib/screens/I9Ember.svelte"),
    I10: () => import("#lib/screens/I10Gone.svelte"),
    I12: () => import("#lib/screens/I12Outside.svelte"),
    crew: () => import("#lib/components/CrewScene.svelte"),
  };

  let C = $state<Any | null>(null);
  let props = $state<Record<string, unknown>>({});
  let key = $state(0);
  let crew = $state(false);

  onMount(async () => {
    const q = new URL(location.href).searchParams;
    const s = q.get("s") ?? "H5";
    const photo = q.get("photo") === "0" ? "" : "/demo/pond.jpg";
    const sky = {
      hour: q.has("hour") ? Number(q.get("hour")) : undefined,
      rain: q.get("rain") === "1",
      wind: Number(q.get("wind") ?? 0),
    };
    const info: InviteInfo = {
      host: people.host,
      words: flare.words,
      scene: flare.scene,
      photo,
      spot: flare.spot,
      hostLine: flare.hostLine,
      walkMin: flare.walkMin,
      access,
      nature: "",
      met: null,
    };
    const base: Record<string, Record<string, unknown>> = {
      H0: { golden: { kind: "now", minutes: 42 }, weather: { temp_f: 58, rain_likely: sky.rain }, located: true },
      H5: { photo, scene: flare.scene, have: Number(q.get("have") ?? 1), quorum: Number(q.get("quorum") ?? 4), sentMin: 2, hostLine: flare.hostLine },
      H6: { coming: 3, spot: flare.spotShort, here: 1 },
      I1: { info, have: Number(q.get("have") ?? 1), quorum: Number(q.get("quorum") ?? 4) },
      I6: { info, view: q.get("view") ?? "lit", smallerAt: flare.emberBench },
      I9: { info, bench: flare.emberBench, meters: flare.emberMeters, have: 1 },
      I10: {},
      I12: { minutes: Number(q.get("min") ?? 72), photo, people: [people.host, ...people.friends.slice(0, 2)] },
      crew: {
        people: [people.host, ...people.friends].map((name) => ({ name })),
        weekMin: Number(q.get("min") ?? 72),
        sparks: ["Geese took our bench. We let them.", "Cider was cold, sun was not."],
        empty: q.get("empty") === "1",
      },
    };
    props = { ...(base[s] ?? {}), sky, hour: sky.hour, wind: sky.wind };
    (window as unknown as { flareDev: object }).flareDev = {
      set: (p: Record<string, unknown>) => Object.assign(props, p),
      remount: () => (key += 1),
    };
    crew = s === "crew";
    C = (await (load[s] ?? load.H5)()).default;
    document.documentElement.dataset.ready = "1";
  });
</script>


<PhoneFrame>
  {#if C}
    {#key key}
      {#if crew}
        <Screen stage close={false} heading="Crew">
          {#snippet backdropArt()}<Scenery people={false} sky={props.sky as never} />{/snippet}
          {#snippet hero()}<C {...props} />{/snippet}
          <p>Sample crew.</p>
        </Screen>
      {:else}<C {...props} />{/if}
    {/key}
  {:else}
    <main><h1>Flare motion</h1></main>
  {/if}
</PhoneFrame>
