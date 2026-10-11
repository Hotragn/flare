<!-- O7 Post in Telegram (ADR-0013, ADR-0023, contracts/telegram.md 2): say what Telegram sees,
     add the bot to a group with a one-time t.me link, and choose whether real photos go there
     (off by default: the bot posts a Flare card). Opens only from the menu. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import Screen from "#lib/components/Screen.svelte";
  import Button from "#lib/components/Button.svelte";
  import Choice from "#lib/components/Choice.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { GroupRecord } from "@flare/shared/icd/client";
  import { ApiError, loadTelegram, saveTelegramPhotos, telegramLink, type TelegramState } from "../more.ts";
  import { openGroup } from "../wire.ts";
  import { back } from "../back.ts";

  type View = { s: "loading" } | { s: "nogroup" } | { s: "error"; msg: string } | { s: "ready"; tg: TelegramState };
  let view: View = $state({ s: "loading" });
  let group: GroupRecord | null = null;
  let photos = $state("off");
  /** The value the server has; a change to `photos` that differs is saved. */
  let saved = "off";
  let status = $state("");
  let adding = $state(false);

  const message = (e: unknown) => {
    const kind = e instanceof ApiError ? e.kind : "server";
    return t(kind === "network" ? "err.network" : kind === "rateLimit" ? "err.rateLimit" : "err.server");
  };

  async function load() {
    view = { s: "loading" };
    const g = await openGroup(page.url);
    if (!g) {
      view = { s: "nogroup" };
      return;
    }
    group = g.group;
    try {
      const tg = await loadTelegram({ fetch }, g.group);
      photos = tg.showPhotos ? "on" : "off";
      saved = photos;
      view = { s: "ready", tg };
    } catch (e) {
      view = { s: "error", msg: message(e) };
    }
  }
  onMount(load);

  async function add() {
    if (!group) return;
    adding = true;
    status = "";
    try {
      location.href = await telegramLink({ fetch }, group);
    } catch (e) {
      status = message(e);
    } finally {
      adding = false;
    }
  }

  // Saved on change; the setting screen is the disclosure (ADR-0023).
  $effect(() => {
    const want = photos;
    if (view.s !== "ready" || !group || want === saved) return;
    saved = want;
    status = "";
    saveTelegramPhotos({ fetch }, group, want === "on").then(
      (on) => {
        saved = on ? "on" : "off";
        status = t("tg.saved");
      },
      (e) => {
        status = message(e);
      },
    );
  });
</script>

<svelte:head><title>{t("tg.title")}</title></svelte:head>

<Screen heading={t("tg.title")} title={t("tg.title")} onclose={back}>
  {#if view.s === "loading"}
    <p class="t-muted" role="status">{t("app.loading")}</p>
  {:else if view.s === "nogroup"}
    <p role="status">{t("more.noGroup")}</p>
  {:else if view.s === "error"}
    <p role="alert">{view.msg}</p>
    <Button variant="secondary" onclick={load}>{t("err.retry")}</Button>
  {:else if !view.tg.available}
    <p role="status">{t("tg.unavailable")}</p>
  {:else}
    <p>{t("tg.what")}</p>
    <p class="lock"><Icon name="info" size={20} /><span>{t("tg.sees")}</span></p>
    <p class="state" role="status">{view.tg.connected ? t("tg.connected") : t("tg.notYet")}</p>
    <Choice
      label={t("tg.photos")}
      bind:value={photos}
      options={[
        { value: "off", label: t("tg.off") },
        { value: "on", label: t("tg.on") },
      ]}
    />
    <p class="t-small t-muted">{photos === "on" ? t("tg.photosNote") : t("tg.photosOffNote")}</p>
    {#if status}<p role="status">{status}</p>{/if}
  {/if}
  {#snippet actions()}
    {#if view.s === "ready" && view.tg.available}
      <Button icon="share" onclick={add} loading={adding}>{t("tg.add")}</Button>
      <p class="t-small t-muted center">{t("tg.steps")}</p>
    {/if}
  {/snippet}
</Screen>

<style>
  p { margin: 0; }
  .center { text-align: center; }
  .lock { display: flex; gap: 8px; align-items: flex-start; }
  .state { font-weight: 700; }
</style>
