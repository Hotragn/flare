<!-- H3 Send it: quorum (the only setting, SRS-CRE-5), host line, and what's near. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import Choice from "../components/Choice.svelte";
  import TextField from "../components/TextField.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import Icon from "../components/Icon.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "ready", theme = "light", wire = false, onsend }: { view?: string; theme?: Theme; wire?: boolean; onsend?: () => void } = $props();
  let quorum = $state("2");
  let hostLine = $state(flare.hostLine);
</script>

<Screen {theme} {wire} title="Send it" offline={view === "offline" ? "Offline. It sends when you're back." : ""}>
  <div class="top">
    <div class="thumb"><PhotoPrint scene={flare.scene} height={150} tilt={-3} /></div>
    <p class="t-title words">{flare.words}</p>
  </div>
  <Choice label="Goes ahead when this many are in, you included" bind:value={quorum} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
  {#if view === "editing"}
    <TextField label="Where you'll be" bind:value={hostLine} hint="Friends see this when it's lit." max={80} />
  {:else}
    <p class="hostline"><span>{hostLine}</span><button class="edit" aria-label="Edit where you'll be"><Icon name="edit" /></button></p>
  {/if}
  <InfoLines nature={flare.sunset} />
  {#if view === "error"}
    <p class="err" role="alert"><Icon name="warning" />Didn't send. Check your signal and try again.</p>
  {/if}
  {#snippet actions()}
    <Button icon="share" loading={view === "sending"} onclick={onsend}>{view === "error" ? "Try again" : view === "offline" ? "Send later" : "Send it"}</Button>
  {/snippet}
</Screen>

<style>
  .top { display: flex; gap: 14px; align-items: center; }
  .thumb { width: 116px; flex: none; }
  .words { margin: 0; }
  .hostline { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; padding: 12px 6px 12px 14px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line); font-weight: 700; }
  .edit { width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; }
  .err { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); border: 2px solid var(--c-ember-700); font-weight: 700; }
</style>
