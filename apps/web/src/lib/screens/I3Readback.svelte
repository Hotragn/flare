<!-- I3 Read-back: the parsed rules in one sentence (≤ 12 words, SRS-COND-5); only rules are sent (BR-C-10). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { InviteInfo, Theme } from "../components/parts";
  let {
    theme = "light",
    info,
    line,
    chips = [],
    busy = false,
    sample = false,
    onyes,
    onfix,
    onclose,
  }: {
    theme?: Theme;
    info: InviteInfo;
    line: string;
    chips?: string[];
    busy?: boolean;
    sample?: boolean;
    onyes?: () => void;
    onfix?: () => void;
    onclose?: () => void;
  } = $props();
</script>

<Screen {theme} {onclose} title={t("invite.title", { host: info.host })}>
  <PhotoPrint scene={info.scene} src={info.photo} {sample} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title={t("readback.title")}>
      <p class="t-title readback" aria-live="polite">{line}</p>
      {#if chips.length}
        <ul class="chips" aria-label={t("readback.chipsAria")}>
          {#each chips as c (c)}<li>{c}</li>{/each}
        </ul>
      {/if}
      <Button haptic="tap" loading={busy} onclick={onyes}>{t("readback.yes")}</Button>
      <Button variant="text" onclick={onfix}>{t("readback.fix")}</Button>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .readback { margin: 0; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
  .chips li { padding: 8px 14px; border-radius: var(--r-pill); background: var(--bg); border: 2px solid var(--line); font-weight: 700; }
</style>
