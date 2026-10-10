<!-- I0 Join a group: first open of a group link. No account, just a first name. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Flame from "../components/Flame.svelte";
  import { t } from "#lib/copy/index.ts";
  import { people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "empty", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  let name = $state("");
  $effect(() => { name = view === "typing" ? "Amor" : ""; });
</script>

<Screen {theme} {wire}>
  <div class="intro">
    <Flame state="lit" size={84} />
    <h1 class="t-title">{t("join.group", { host: people.host })}</h1>
    <p>{t("join.intro")}</p>
  </div>
  <TextField label={t("join.nameLabel")} bind:value={name} placeholder={t("join.namePlaceholder")} hint={t("join.nameHint")} error={view === "error" ? t("join.nameError") : ""} max={24} />
  {#snippet actions()}
    <Button>{t("join.cta")}</Button>
  {/snippet}
</Screen>

<style>
  .intro { display: flex; flex-direction: column; gap: 8px; padding-top: 24px; }
  .intro h1, .intro p { margin: 0; }
</style>
