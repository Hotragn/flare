<!-- P4 Plan invite: the ladder, the count at the biggest step that can still light, and a private yes. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Ladder from "../components/Ladder.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import { plan } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "open", theme = "light", wire = false, onyes, onshort }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void; onshort?: () => void } = $props();
</script>

<Screen {theme} {wire} title="From Fuego">
  <h1 class="t-invite">{plan.ask}</h1>
  <p class="t-muted">Answer by {plan.deadline}. Four sizes, biggest first.</p>
  <FlameMeter have={view === "need" ? 2 : 1} quorum={3} note={view === "need" ? "Need 1 more for the Ford Woods loop." : "Nobody sees who. Only the count."} />
  <Ladder steps={plan.steps} />
  {#snippet actions()}
    <Button icon="here" onclick={onyes}>I'm in</Button>
    <Button variant="text" onclick={onshort}>Short one only</Button>
  {/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
</style>
