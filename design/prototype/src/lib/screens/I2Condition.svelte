<!-- I2 Add a condition (sheet over the invite). Free text stays on the phone (SRS-COND-6). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import { flare } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "empty", theme = "light", wire = false, oncheck }: { view?: string; theme?: Theme; wire?: boolean; oncheck?: () => void } = $props();
  let text = $state("");
  $effect(() => {
    text = { typing: "only if Amor comes, back by 5", dictating: "after two", "didnt-catch": "maybe later idk", "not-in-group": "only if Bob comes" }[view] ?? "";
  });
  const error = $derived(view === "didnt-catch" ? "I didn't catch that. Try 'after 2' or 'only with Amor'." : view === "not-in-group" ? "Bob isn't in this group." : "");
</script>

<Screen {theme} {wire} title="From Fuego">
  <PhotoPrint scene={flare.scene} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title="Add a condition" description="In your own words. It never leaves your phone; only the rule does.">
      <TextField label="I'm in if…" bind:value={text} placeholder="after 2, back by 5, only with Amor" mic listening={view === "dictating"} {error} multiline max={120} />
      <Button onclick={oncheck} disabled={!text}>Check it</Button>
    </Sheet>
  {/snippet}
</Screen>
