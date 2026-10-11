<!-- O2 My needs (BR-A-1, SRS-ACC-1): set once, stored only on this phone. No request leaves the page. -->
<script lang="ts">
  import { onMount } from "svelte";
  import Screen from "#lib/components/Screen.svelte";
  import Button from "#lib/components/Button.svelte";
  import Choice from "#lib/components/Choice.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Store } from "@flare/shared/icd/client";
  import { EMPTY_FORM, needsToForm, readNeeds, saveNeeds, type NeedsForm } from "../more.ts";
  import { phoneModules } from "../wire.ts";
  import { back } from "../back.ts";
  import { playWarm, setWarm, warmOn } from "#lib/compass/voice.ts";

  let store: Store | null = $state(null);
  let ready = $state(false);
  let form: NeedsForm = $state({ ...EMPTY_FORM });
  let wasSet = $state(false);
  let status = $state("");
  let saving = $state(false);
  // ADR-0027: the compass's warm voice, a setting on this phone like the needs.
  let warm = $state("no");
  onMount(() => {
    warm = warmOn() ? "yes" : "no";
  });
  const changeWarm = (v: string) => {
    warm = v;
    void setWarm(v === "yes");
  };

  onMount(async () => {
    store = (await phoneModules()).store;
    if (store) {
      const n = await readNeeds(store).catch(() => null);
      wasSet = n !== null;
      form = needsToForm(n);
    }
    ready = true;
  });

  async function save() {
    if (!store) return;
    saving = true;
    try {
      await saveNeeds(store, form);
      wasSet = true;
      status = t("needs.saved");
    } catch {
      status = t("err.storageFull");
    } finally {
      saving = false;
    }
  }

  const yesNo = [{ value: "yes", label: t("needs.yes") }, { value: "no", label: t("needs.no") }];
  const rests = [
    { value: "100", label: t("needs.m100") },
    { value: "200", label: t("needs.m200") },
    { value: "400", label: t("needs.m400") },
    { value: "none", label: t("needs.none") },
  ];
</script>

<svelte:head><title>{t("needs.title")}</title></svelte:head>

<Screen heading={t("needs.title")} title={t("needs.title")} onclose={back}>
  <p class="lock"><Icon name="info" size={20} /><span>{t("needs.lock")}</span></p>
  {#if ready && !store}
    <p role="status">{t("err.oldBrowser")}</p>
  {:else}
    <Choice label={t("needs.steps")} bind:value={form.steps} options={yesNo} />
    <Choice label={t("needs.rest")} bind:value={form.rest} options={rests} />
    <Choice label={t("needs.restroom")} bind:value={form.wc} options={yesNo} />
    <p class="t-small t-muted">{wasSet ? t("needs.foot") : t("needs.empty")}</p>
  {/if}
  <!-- ADR-0027: saved the moment you choose, not with Save (it is this phone's setting). -->
  <div class="warm">
    <Choice label={t("voice.title")} bind:value={() => warm, changeWarm} options={yesNo} />
    <p class="t-small t-muted">{t("voice.sub")}</p>
    <Button variant="text" icon="sound" onclick={() => void playWarm(["m-150", "dir-slightLeft"])}>{t("voice.try")}</Button>
  </div>
  <p class="t-small" role="status" aria-live="polite">{status}</p>
  {#snippet actions()}<Button onclick={save} loading={saving} disabled={!store}>{t("needs.save")}</Button>{/snippet}
</Screen>

<style>
  .warm { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; padding-top: 8px; border-top: 1px solid var(--line); }
  .lock { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); font-weight: 700; }
  p { margin: 0; }
</style>
