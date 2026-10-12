<!-- I2 Add a condition (sheet over the invite). Free text stays on the phone (SRS-COND-6). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { InviteInfo, Theme } from "../components/parts";
  let {
    theme = "light",
    info,
    text = $bindable(""),
    error = "",
    listening = false,
    canDictate = false,
    sample = false,
    suggest = [],
    oncheck,
    ondictate,
    onclose,
  }: {
    theme?: Theme;
    info: InviteInfo;
    text?: string;
    error?: string;
    listening?: boolean;
    canDictate?: boolean;
    sample?: boolean;
    /** Tap-to-fill rules after a miss: one tap fills and checks it. */
    suggest?: { label: string; text: string }[];
    oncheck?: (text: string) => void;
    ondictate?: () => void;
    onclose?: () => void;
  } = $props();
</script>

<Screen {theme} {onclose} title={t("invite.title", { host: info.host })}>
  <PhotoPrint scene={info.scene} src={info.photo} {sample} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title={t("cond.title")} description={t("cond.body")}>
      <TextField label={t("cond.label")} bind:value={text} placeholder={t("cond.placeholder")} mic={canDictate} {listening} onmic={ondictate} {error} multiline max={120} />
      {#if suggest.length}
        <ul class="chips" aria-label={t("cond.chipsAria")}>
          {#each suggest as c (c.text)}<li><button type="button" onclick={() => { text = c.text; oncheck?.(c.text); }}>{c.label}</button></li>{/each}
        </ul>
      {/if}
      <Button onclick={() => oncheck?.(text)} disabled={!text.trim()}>{t("cond.check")}</Button>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .chips { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
  .chips button { min-height: 44px; padding: 0 14px; border-radius: var(--r-pill); background: var(--bg); border: 2px solid var(--line); color: inherit; font: inherit; font-weight: 700; }
</style>
