<!-- I0 Join a group: first yes from a group link. No account, just a first name (SRS-ID-3, -4). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Flame from "../components/Flame.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    theme = "light",
    host,
    name = $bindable(""),
    error = "",
    busy = false,
    onjoin,
    onclose,
  }: { theme?: Theme; host: string; name?: string; error?: string; busy?: boolean; onjoin?: (name: string) => void; onclose?: () => void } = $props();
  let tried = $state(false);
  const nameError = $derived(error || (tried && !name.trim() ? t("join.nameError") : ""));
  function submit(e: SubmitEvent) {
    e.preventDefault();
    tried = true;
    if (name.trim()) onjoin?.(name.trim());
  }
</script>

<Screen {theme} {onclose}>
  <form id="join" class="intro" onsubmit={submit}>
    <Flame state="lit" size={84} />
    <h1 class="t-title">{t("join.group", { host })}</h1>
    <p>{t("join.intro")}</p>
    <TextField label={t("join.nameLabel")} bind:value={name} placeholder={t("join.namePlaceholder")} hint={t("join.nameHint")} error={nameError} max={24} />
  </form>
  {#snippet actions()}
    <Button type="submit" form="join" loading={busy}>{t("join.cta")}</Button>
  {/snippet}
</Screen>

<style>
  .intro { display: flex; flex-direction: column; gap: 8px; padding-top: 24px; }
  .intro h1, .intro p { margin: 0; }
</style>
