<!-- /g/{gatheringId}/#k={key}: the invitee's link page (FE3). Opens in Safari, no install, no account (SRS-RES-1). -->
<script lang="ts">
  import { page } from "$app/state";
  import { t } from "#lib/copy/index.ts";
  import Screen from "#lib/components/Screen.svelte";
  import LinkPage from "#lib/screens/LinkPage.svelte";
  import type { Deps } from "#lib/screens/flow/deps.ts";
  import { wire } from "#lib/screens/flow/wire.ts";
  import { keyFromHash } from "#lib/crypto/index.ts";
  import { takeBindToken } from "#lib/outbox/bind.ts";

  let deps: Deps | null = null;
  let failed = false;
  try {
    deps = wire();
  } catch {
    failed = true; // a phone module is missing: say so plainly instead of a broken page
  }
  const fragment = keyFromHash(location.hash);
  const bindToken = takeBindToken(); // single use; removed from the address bar at once
</script>

<svelte:head><title>{t("app.name")}</title></svelte:head>

{#if deps}
  <LinkPage {deps} gatheringId={page.params.id ?? ""} {fragment} {bindToken} />
{:else if failed}
  <Screen close={false}><p class="t-title" role="alert">{t("err.oldBrowser")}</p></Screen>
{/if}
