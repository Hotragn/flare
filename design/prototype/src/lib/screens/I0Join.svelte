<!-- I0 Join a group: first open of a group link. No account, just a first name. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Flame from "../components/Flame.svelte";
  import type { Theme } from "../components/parts";
  let { view = "empty", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  let name = $state("");
  $effect(() => { name = view === "typing" ? "Amor" : ""; });
</script>

<Screen {theme} {wire}>
  <div class="intro">
    <Flame state="lit" size={84} />
    <h1 class="t-title">Fuego's friends</h1>
    <p>You're joining a group. No account, no password.</p>
  </div>
  <TextField label="Your first name" bind:value={name} placeholder="Amor" hint="Only this group sees it." error={view === "error" ? "Add a name, even a nickname." : ""} max={24} />
  {#snippet actions()}
    <Button>Join</Button>
  {/snippet}
</Screen>

<style>
  .intro { display: flex; flex-direction: column; gap: 8px; padding-top: 24px; }
  .intro h1, .intro p { margin: 0; }
</style>
