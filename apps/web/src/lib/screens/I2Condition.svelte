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
      <Button onclick={() => oncheck?.(text)} disabled={!text.trim()}>{t("cond.check")}</Button>
    </Sheet>
  {/snippet}
</Screen>
