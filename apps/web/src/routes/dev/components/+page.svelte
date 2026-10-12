<!-- Component catalog: every component in every state, in light, dark and sun mode. -->
<script lang="ts">
  import Button from "#lib/components/Button.svelte";
  import Flame from "#lib/components/Flame.svelte";
  import FlameMeter from "#lib/components/FlameMeter.svelte";
  import Hearth from "#lib/components/Hearth.svelte";
  import PhotoPrint from "#lib/components/PhotoPrint.svelte";
  import TextField from "#lib/components/TextField.svelte";
  import Choice from "#lib/components/Choice.svelte";
  import InfoLines from "#lib/components/InfoLines.svelte";
  import Compass from "#lib/components/Compass.svelte";
  import Ladder from "#lib/components/Ladder.svelte";
  import NeedCount from "#lib/components/NeedCount.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { icons } from "#lib/brand.ts";
  import { access, flare, plan } from "#lib/sample.ts";
  const themes = [["light", { "data-theme": "light" }], ["dark", { "data-theme": "dark" }], ["sun", { "data-sun": "" }]] as const;
  let q = $state("3");
  let v1 = $state("");
  let v2 = $state("only if Amor comes");
  // ?s=H5 (and the rest, see Moments.svelte): one app screen at phone size for the motion tools.
  let moments = $state(false);
  $effect(() => { moments = new URL(location.href).searchParams.has("s"); });
</script>

<svelte:head><title>Flare components</title></svelte:head>

{#if moments}
  {#await import("./Moments.svelte") then { default: Moments }}<Moments />{/await}
{:else}
<main class="page" data-theme="light">
  <h1 class="t-title">Flare components</h1>
  <p>Every component and state. Tokens: design/system/tokens.css. Source: design/prototype/src/lib/components.</p>
  {#each themes as [name, attrs]}
    <section class="theme" {...attrs}>
      <h2 class="t-heading">{name}</h2>

      <h3>Button</h3>
      <div class="row">
        <Button full={false}>I'm in</Button>
        <Button full={false} pressed>Pressed</Button>
        <Button full={false} loading>Sending</Button>
        <Button full={false} disabled>Disabled</Button>
        <Button full={false} icon="compass">Find them</Button>
        <Button full={false} variant="secondary" icon="here">I'm here</Button>
        <Button full={false} variant="text">Add a condition</Button>
        <Button full={false} variant="danger">End it</Button>
      </div>

      <h3>Flame states</h3>
      <div class="row">
        <Flame state="kindling" progress={0} size={90} />
        <Flame state="kindling" progress={0.5} size={90} />
        <Flame state="kindling" progress={1} size={90} />
        <Flame state="lit" size={90} />
        <Flame state="ember" size={90} />
        <Flame state="gone" size={90} />
      </div>

      <h3>FlameMeter</h3>
      <div class="col">
        <FlameMeter have={1} quorum={3} />
        <FlameMeter have={2} quorum={3} />
        <FlameMeter state="lit" have={3} quorum={3} />
        <FlameMeter state="ember" have={1} quorum={2} note="One more friend and it's on." />
      </div>

      <h3>Hearth</h3>
      <div class="row"><div style="width:220px"><Hearth state="kindling" progress={0.4} size={120} /></div><div style="width:220px"><Hearth state="lit" size={120} /></div><div style="width:220px"><Hearth state="ember" size={120} /></div><div style="width:220px"><Hearth state="gone" size={120} /></div></div>

      <h3>PhotoPrint</h3>
      <div class="row"><div style="width:200px"><PhotoPrint state="blank" height={220} /></div><div style="width:200px"><PhotoPrint state="developed" height={220} scene="Sample" /></div></div>

      <h3>TextField</h3>
      <div class="col">
        <TextField label="Your first name" bind:value={v1} placeholder="Amor" hint="Only this group sees it." />
        <TextField label="I'm in if…" bind:value={v2} mic multiline max={120} />
        <TextField label="I'm in if…" value="only if Bob comes" error="Bob isn't in this group." />
        <TextField label="I'm in if…" value="after two" mic listening />
      </div>

      <h3>Choice</h3>
      <Choice label="Goes ahead when this many are in" bind:value={q} options={["2", "3", "4"].map((x) => ({ value: x, label: x }))} />

      <h3>NeedCount, InfoLines</h3>
      <div class="col"><NeedCount have={1} quorum={3} /><NeedCount have={3} quorum={3} lit /><InfoLines access={access} nature={flare.sunset} /><InfoLines access={{ ...access, benches: { count: 0, nearest_m: null }, water: { count: 1, nearest_m: 60 }, steps_mapped: true }} nature={flare.sunset} /></div>

      <h3>Ladder</h3>
      <div class="col" style="max-width:380px"><Ladder steps={plan.steps} current={2} /><Ladder steps={plan.steps} editable editing={1} /></div>

      <h3>Compass</h3>
      <div class="row"><Compass status="pointing" bearing={-35} /><Compass status="facing" meters={60} bearing={3} /><Compass status="no-orientation" /><Compass status="no-gps" /></div>

      <h3>Icons ({Object.keys(icons).length})</h3>
      <div class="row icons">{#each Object.keys(icons) as n}<span class="ic"><Icon name={n} size={28} /><small>{n}</small></span>{/each}</div>
    </section>
  {/each}
</main>
{/if}

<style>
  .page { padding: 24px; }
  .theme { background: var(--bg); color: var(--text); padding: 24px; border-radius: var(--r-lg); margin: 16px 0 32px; display: flex; flex-direction: column; gap: 12px; }
  h3 { margin: 12px 0 0; font-size: 1rem; color: var(--text-muted); }
  .row { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end; }
  .col { display: flex; flex-direction: column; gap: 12px; max-width: 420px; }
  .ic { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; width: 72px; }
  small { font-size: 0.75rem; }
</style>
