<!-- P5 Plan lit at a step (sun mode). "I'm fading" makes it one step smaller, privately. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Hearth from "../components/Hearth.svelte";
  import Ladder from "../components/Ladder.svelte";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "step-1", theme = "sun", wire = false, onfade }: { view?: string; theme?: Theme; wire?: boolean; onfade?: () => void } = $props();
  const step = $derived(view === "step-2" ? 2 : view === "smaller" ? 3 : 1);
</script>

<Screen {theme} {wire} title={plan.ask}>
  <Hearth state="lit" size={130} celebrate={view === "step-1"} horizon={false} />
  <h1 class="t-title center">{view === "smaller" ? "Smaller plan: " : "It's on: "}{plan.steps[step - 1].name} at {plan.start}.</h1>
  <Ladder steps={plan.steps} current={step} />
  {#snippet actions()}
    <Button icon="compass">Find them</Button>
    <Button variant="text" onclick={onfade}>I'm fading</Button>
  {/snippet}
</Screen>

<style>
  .center { text-align: center; margin: 0; }
</style>
