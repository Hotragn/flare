<!-- I3 Read-back: the parsed rule in one sentence (≤ 12 words, SRS-COND-5). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import { t, readback } from "#lib/copy/index.ts";
  import { flare, people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "flare", theme = "light", wire = false, onyes }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void } = $props();
  const back = t("readback.rule.backBy", { time: "5 PM" });
  const line = $derived(view === "plan" ? readback([t("readback.rule.maxStep", { k: 3 }), back]) : readback([t("readback.rule.with", { name: "Amor" }), back]));
</script>

<Screen {theme} {wire} title={t("invite.title", { host: people.host })}>
  <PhotoPrint scene={flare.scene} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title={t("readback.title")}>
      <p class="t-title readback" aria-live="polite">{line}</p>
      <ul class="chips" aria-label={t("readback.chipsAria")}>
        {#if view === "plan"}<li>{t("readback.chip.maxStep", { k: 3 })}</li>{:else}<li>{t("readback.chip.with", { name: "Amor" })}</li>{/if}
        <li>{t("readback.chip.backBy", { time: "5:00 PM" })}</li>
      </ul>
      <Button onclick={onyes}>{t("readback.yes")}</Button>
      <Button variant="text">{t("readback.fix")}</Button>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .readback { margin: 0; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
  .chips li { padding: 8px 14px; border-radius: var(--r-pill); background: var(--bg); border: 2px solid var(--line); font-weight: 700; }
</style>
