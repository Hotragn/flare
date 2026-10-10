<!-- H6 Host, Lit (sun mode). Arrivals and +1 (BR-H-*). Done ends it for everyone. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Flame from "../components/Flame.svelte";
  import Sheet from "../components/Sheet.svelte";
  import Icon from "../components/Icon.svelte";
  import { people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "lit", theme = "sun", wire = false, ondone }: { view?: string; theme?: Theme; wire?: boolean; ondone?: () => void } = $props();
  const here = $derived(view === "lit" ? 1 : 3);
</script>

<Screen {theme} {wire} title="It's lit">
  <div class="center">
    <Flame state="lit" size={190} />
    <h1 class="t-display">It's lit.</h1>
    <p class="t-sun">3 are coming. Wait at the bench by the pond.</p>
  </div>
  <div class="here" aria-live="polite">
    <span class="t-heading">Here: {here}</span>
    <Button variant="secondary" icon="plusone" full={false}>Add one</Button>
  </div>
  {#snippet actions()}
    <Button onclick={ondone}>We're done</Button>
  {/snippet}
  {#snippet overlay()}
    {#if view === "plusone"}
      <Sheet inline title="Who's here?" description="Only you see these names.">
        <ul class="names">
          {#each people.friends as n, i}
            <li><button class="row" aria-pressed={i < 2}><span>{n}</span>{#if i < 2}<Icon name="here" />{/if}</button></li>
          {/each}
          <li><button class="row"><span>Someone else</span><Icon name="plusone" /></button></li>
        </ul>
      </Sheet>
    {:else if view === "done"}
      <Sheet inline title="End it for everyone?" description="Then it's gone. Nothing is kept but a count.">
        <Button>End it</Button>
        <Button variant="text">Not yet</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .here { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--surface); border-radius: var(--r-md); border: 2px solid var(--line); }
  .names { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .row { width: 100%; min-height: 52px; display: flex; justify-content: space-between; align-items: center; padding: 0 16px; border-radius: var(--r-md); border: 2px solid var(--line); background: var(--bg); font-weight: 700; }
  .row[aria-pressed="true"] { border-color: var(--positive); }
</style>
