<!-- I5 This spot may not suit you. Private to this person; only an Ember-only flag is sent (SRS-ACC-3, BR-A-3). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Sheet from "../components/Sheet.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { InviteInfo, Theme } from "../components/parts";
  let {
    theme = "light",
    info,
    reasons = [],
    busy = false,
    sample = false,
    onyes,
    onno,
  }: {
    theme?: Theme;
    info: InviteInfo;
    reasons?: { icon: string; text: string }[];
    busy?: boolean;
    sample?: boolean;
    onyes?: () => void;
    onno?: () => void;
  } = $props();
</script>

<Screen {theme} onclose={onno} title={t("invite.title", { host: info.host })}>
  <PhotoPrint scene={info.scene} src={info.photo} {sample} height={260} tilt={1.2} />
  {#snippet overlay()}
    <Sheet inline title={t("notSuit.title")} description={t("notSuit.body")}>
      {#if reasons.length}
        <ul class="why">
          {#each reasons as r (r.text)}<li><Icon name={r.icon} /><span>{r.text}</span></li>{/each}
        </ul>
      {/if}
      <p class="t-sun">{t("notSuit.ask")}</p>
      <Button loading={busy} onclick={onyes}>{t("notSuit.yes")}</Button>
      <Button variant="text" onclick={onno}>{t("notSuit.no")}</Button>
    </Sheet>
  {/snippet}
</Screen>

<style>
  .why { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-weight: 700; }
  .why li { display: flex; gap: 8px; align-items: center; }
  .t-sun { margin: 0; }
</style>
