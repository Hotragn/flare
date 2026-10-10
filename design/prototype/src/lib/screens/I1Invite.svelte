<!-- I1 Invite: what a friend sees from the link. One button, private. Target ≤ 10 s. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import NeedCount from "../components/NeedCount.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import Icon from "../components/Icon.svelte";
  import Flame from "../components/Flame.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "kindling", theme = "light", wire = false, onyes, oncondition }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void; oncondition?: () => void } = $props();
</script>

<Screen {theme} {wire} title="From Fuego">
  {#if view === "loading"}
    <div class="skeleton print-sk" aria-hidden="true"></div>
    <div class="skeleton line" aria-hidden="true"></div>
    <div class="skeleton line short" aria-hidden="true"></div>
    <p class="visually-hidden" role="status">Loading the invite</p>
  {:else if view === "missing-key"}
    <div class="center">
      <Icon name="warning" size={48} />
      <h1 class="t-title">This link is missing its key.</h1>
      <p class="t-muted">Ask Fuego to send it again. The key is the part after #.</p>
    </div>
  {:else if view === "gone"}
    <div class="center">
      <Flame state="gone" size={120} />
      <h1 class="t-title">Not this time.</h1>
      <p class="t-muted">This Flare is over. Nothing about it was kept.</p>
    </div>
  {:else}
    <PhotoPrint scene={flare.scene} height={300} tilt={1.2} />
    <p class="t-invite words">{flare.words}</p>
    <p class="where"><Icon name="hotspots" size={22} /><span><b>Fuego</b> is at {flare.spot}. {flare.walk}.</span></p>
    <NeedCount have={view === "lit" ? 2 : 1} quorum={2} lit={view === "lit"} />
    <InfoLines nature={flare.sunset} />
  {/if}
  {#snippet actions()}
    {#if view === "kindling" || view === "lit"}
      <Button icon="here" onclick={onyes}>I'm in</Button>
      <Button variant="text" onclick={oncondition}>Add a condition</Button>
    {:else if view === "missing-key" || view === "gone"}
      <Button variant="secondary">Close</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .words { margin: 0; }
  .where { display: flex; gap: 8px; align-items: flex-start; margin: 0; }
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .skeleton { background: color-mix(in srgb, var(--text) 9%, transparent); border-radius: var(--r-md); animation: pulse 1.4s var(--ease-in-out) infinite; }
  .print-sk { height: 300px; }
  .line { height: 32px; }
  .short { width: 60%; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
