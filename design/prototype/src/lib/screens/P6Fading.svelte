<!-- P6 I'm fading: confirm privately; everyone sees only "Smaller plan" (BR-P-7). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import Ladder from "../components/Ladder.svelte";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "confirm", theme = "sun", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
</script>

<Screen {theme} {wire} title={plan.ask}>
  <Ladder steps={plan.steps} current={view === "notice" ? 3 : 2} />
  {#snippet overlay()}
    {#if view === "confirm"}
      <Sheet inline title="Make it one step smaller?" description="Everyone sees 'Smaller plan.' Nobody sees it was you.">
        <p class="t-sun">Next: {plan.steps[2].name}, {plan.steps[2].minutes} min.</p>
        <Button>Make it smaller</Button>
        <Button variant="text">Keep going</Button>
      </Sheet>
    {:else}
      <Sheet inline title="Smaller plan.">
        <p class="t-sun">{plan.steps[2].name}, {plan.steps[2].minutes} min. Same spot.</p>
        <Button variant="secondary">Got it</Button>
      </Sheet>
    {/if}
  {/snippet}
</Screen>

<style>
  .t-sun { margin: 0; }
</style>
