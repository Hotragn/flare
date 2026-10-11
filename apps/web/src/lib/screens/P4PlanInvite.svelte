<!-- P4 Plan invite: the ladder, the count at the biggest step that can still light, and a private yes. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Ladder from "../components/Ladder.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import { t } from "#lib/copy/index.ts";
  import { plan, people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "open", theme = "light", wire = false, onyes, onshort }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void; onshort?: () => void } = $props();
</script>

<Screen {theme} {wire} sound title={t("invite.title", { host: people.host })}>
  <h1 class="t-invite">{plan.ask}</h1>
  <p class="t-muted">{t("planInvite.meta", { deadline: plan.deadline })}</p>
  <FlameMeter have={view === "need" ? 2 : 1} quorum={3} note={view === "need" ? t("planInvite.needAt", { n: 1, k: 1, step: plan.steps[0].name }) : t("planInvite.private")} />
  <Ladder steps={plan.steps} />
  {#snippet actions()}
    <Button icon="here" onclick={onyes}>{t("invite.yes")}</Button>
    <Button variant="text" onclick={onshort}>{t("planInvite.short")}</Button>
  {/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
</style>
