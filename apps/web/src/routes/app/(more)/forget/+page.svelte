<!-- Forget this group (SRS-ID-6, ADR-0015). The server goes first; this phone forgets only after. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import Screen from "#lib/components/Screen.svelte";
  import Button from "#lib/components/Button.svelte";
  import { t } from "#lib/copy/index.ts";
  import { ApiError, forgetGroup } from "../more.ts";
  import { idemKey, openGroup } from "../wire.ts";
  import { back } from "../back.ts";

  type Opened = NonNullable<Awaited<ReturnType<typeof openGroup>>>;
  let g = $state<Opened | null>(null);
  let phase: "loading" | "nogroup" | "ask" | "working" | "done" = $state("loading");
  let error = $state("");

  onMount(async () => {
    g = await openGroup(page.url);
    phase = g ? "ask" : "nogroup";
  });

  // Names this phone knows for the group; one name means you're the last one (forget.last).
  const lastOne = $derived(g ? Object.keys(g.group.names).length <= 1 : false);

  async function forget() {
    if (!g) return;
    phase = "working";
    error = "";
    try {
      await forgetGroup({ fetch, store: g.store, idemKey }, g.group);
      phase = "done";
    } catch (e) {
      const kind = e instanceof ApiError ? e.kind : "server";
      error = kind === "network" ? t("err.network") : kind === "rateLimit" ? t("err.rateLimit") : t("forget.failed");
      phase = "ask";
    }
  }
</script>

<svelte:head><title>{t("menu.forget")}</title></svelte:head>

<Screen heading={t("forget.title")} title={t("menu.forget")} onclose={back}>
  {#if phase === "loading"}
    <p class="t-muted" role="status">{t("app.loading")}</p>
  {:else if phase === "nogroup"}
    <p role="status">{t("more.noGroup")}</p>
  {:else if phase === "done"}
    <p role="status">{t("forget.done")}</p>
  {:else}
    <p>{t("forget.body")}</p>
    {#if lastOne}<p>{t("forget.last")}</p>{/if}
    {#if error}<p role="alert" class="err">{error}</p>{/if}
  {/if}
  {#snippet actions()}
    {#if phase === "ask" || phase === "working"}
      <Button variant="danger" onclick={forget} loading={phase === "working"}>{t("forget.yes")}</Button>
      <Button variant="text" onclick={back}>{t("forget.no")}</Button>
    {:else}
      <Button variant="secondary" onclick={back}>{t("app.close")}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  p { margin: 0; }
  .err { color: var(--danger, inherit); font-weight: 700; }
</style>
