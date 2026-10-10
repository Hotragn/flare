<!-- I2 Add a condition (sheet over the invite). Free text stays on the phone (SRS-COND-6). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare, people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "empty", theme = "light", wire = false, oncheck }: { view?: string; theme?: Theme; wire?: boolean; oncheck?: () => void } = $props();
  let text = $state("");
  // What the person typed or said (sample input, not product copy).
  $effect(() => {
    text = { typing: "only if Amor comes, back by 5", dictating: "after two", "didnt-catch": "maybe later idk", "not-in-group": "only if Kai comes" }[view] ?? "";
  });
  const error = $derived(view === "didnt-catch" ? t("cond.didntCatch") : view === "not-in-group" ? t("cond.notInGroup", { name: "Kai" }) : "");
</script>

<Screen {theme} {wire} title={t("invite.title", { host: people.host })}>
  <PhotoPrint scene={flare.scene} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title={t("cond.title")} description={t("cond.body")}>
      <TextField label={t("cond.label")} bind:value={text} placeholder={t("cond.placeholder")} mic listening={view === "dictating"} {error} multiline max={120} />
      <Button onclick={oncheck} disabled={!text}>{t("cond.check")}</Button>
    </Sheet>
  {/snippet}
</Screen>
