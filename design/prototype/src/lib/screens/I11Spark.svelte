<!-- I11 Spark: one line in your own words, once, optional (BR-K-1..3). No AI help offered. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Icon from "../components/Icon.svelte";
  import type { Theme } from "../components/parts";
  let { view = "empty", theme = "light", wire = false, onsave }: { view?: string; theme?: Theme; wire?: boolean; onsave?: () => void } = $props();
  let line = $state("");
  $effect(() => { line = view === "typing" ? "Geese took our bench. We let them." : ""; });
</script>

<Screen {theme} {wire}>
  {#if view === "saved"}
    <div class="center">
      <Icon name="spark" size={56} />
      <h1 class="t-title">Saved.</h1>
      <p>It shows up next time your group meets here.</p>
    </div>
  {:else}
    <div class="intro">
      <Icon name="spark" size={40} />
      <h1 class="t-title">One line about today?</h1>
      <p class="t-muted">Optional. Your words only. Only this group can read it.</p>
    </div>
    <TextField label="Your Spark" bind:value={line} placeholder="The light on the water at 5" max={140} multiline />
  {/if}
  {#snippet actions()}
    {#if view === "saved"}
      <Button variant="secondary">Close</Button>
    {:else}
      <Button onclick={onsave} disabled={!line}>Save it</Button>
      <Button variant="text">Skip</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .intro { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; color: var(--text); }
  .intro h1, .intro p, .center h1, .center p { margin: 0; }
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
</style>
