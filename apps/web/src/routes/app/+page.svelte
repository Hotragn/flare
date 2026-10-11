<!-- /app/: the host app (FE2). Camera first; no account (SRS-CRE-1). -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import Screen from "#lib/components/Screen.svelte";
  import HostPage from "#lib/screens/HostPage.svelte";
  import type { Deps } from "#lib/screens/flow/deps.ts";
  import { wire } from "#lib/screens/flow/wire.ts";

  let deps: Deps | null = null;
  try {
    deps = wire();
  } catch {
    deps = null;
  }
</script>

<svelte:head><title>{t("app.name")}</title></svelte:head>

{#if deps}
  <HostPage {deps} />
{:else}
  <Screen close={false}><p class="t-title" role="alert">{t("err.oldBrowser")}</p></Screen>
{/if}
