<!-- P4 Plan invite: the ladder, the count at the biggest step that can still light, and a private yes (SRS-PLAN-2, -3). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Ladder from "../components/Ladder.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Step, Theme } from "../components/parts";
  let {
    theme = "light",
    host,
    ask,
    deadline,
    steps,
    have = 1,
    quorum = 3,
    needAt = "",
    error = "",
    busy = false,
    canCondition = true,
    onyes,
    onshort,
    oncondition,
    onclose,
  }: {
    theme?: Theme;
    host: string;
    ask: string;
    deadline: string; // "10:40 AM"
    steps: Step[];
    have?: number;
    quorum?: number;
    needAt?: string; // planInvite.needAt, when the biggest step is short
    error?: string;
    busy?: boolean;
    canCondition?: boolean;
    onyes?: () => void;
    onshort?: () => void;
    oncondition?: () => void;
    onclose?: () => void;
  } = $props();
</script>

<Screen {theme} sound {onclose} title={t("invite.title", { host })}>
  <h1 class="t-invite">{ask}</h1>
  <p class="t-muted">{t("planInvite.meta", { deadline })}</p>
  <FlameMeter {have} {quorum} note={needAt || t("planInvite.private")} />
  <Ladder {steps} />
  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#snippet actions()}
    <Button icon="here" haptic="tap" loading={busy} onclick={onyes}>{t("invite.yes")}</Button>
    <Button variant="text" onclick={onshort}>{t("planInvite.short")}</Button>
    {#if canCondition}<Button variant="text" onclick={oncondition}>{t("invite.condition")}</Button>{/if}
  {/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
  .err { font-weight: 700; }
</style>
