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

  let store: Store | null = $state(null);
  let ready = $state(false);
  let form: NeedsForm = $state({ ...EMPTY_FORM });
  let wasSet = $state(false);
  let status = $state("");
  let saving = $state(false);

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
  <p class="t-small" role="status" aria-live="polite">{status}</p>
  {#snippet actions()}<Button onclick={save} loading={saving} disabled={!store}>{t("needs.save")}</Button>{/snippet}
</Screen>

<style>
  .lock { display: flex; gap: 8px; align-items: center; margin: 0; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); font-weight: 700; }
  p { margin: 0; }
</style>
