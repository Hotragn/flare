<!-- I1 Invite: what a friend sees from the link. One button, private. Target ≤ 10 s. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import PhotoPrint from "../components/PhotoPrint.svelte";
  import FlameMeter from "../components/FlameMeter.svelte";
  import InfoLines from "../components/InfoLines.svelte";
  import Icon from "../components/Icon.svelte";
  import Flame from "../components/Flame.svelte";
  import { t } from "#lib/copy/index.ts";
  import { flare, sparks, people } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "kindling", theme = "light", wire = false, onyes, oncondition }: { view?: string; theme?: Theme; wire?: boolean; onyes?: () => void; oncondition?: () => void } = $props();
  const host = people.host;
</script>

<Screen {theme} {wire} sound title={t("invite.title", { host })} heading={view === "loading" ? t("invite.loading", { host }) : ""}>
  {#if view === "loading"}
    <div class="skeleton print-sk" aria-hidden="true"></div>
    <div class="skeleton line" aria-hidden="true"></div>
    <div class="skeleton line short" aria-hidden="true"></div>
  {:else if view === "missing-key"}
    <div class="center">
      <Icon name="warning" size={48} />
      <h1 class="t-title">{t("invite.missingKey")}</h1>
      <p class="t-muted">{t("invite.missingKeyHelp", { host })}</p>
    </div>
  {:else if view === "gone"}
    <div class="center">
      <Flame state="gone" size={120} />
      <h1 class="t-title">{t("gone.title")}</h1>
      <p class="t-muted">{t("gone.body")}</p>
    </div>
  {:else}
    <PhotoPrint scene={flare.scene} height={200} tilt={1.2} />
    <h1 class="t-invite words">{flare.words}</h1>
    <div class="where">
      <Icon name="hotspots" size={22} />
      <div>
        <p>{t("invite.whereWalk", { host, spot: flare.spot, walk: flare.walk })}</p>
        <p class="spark t-small"><Icon name="spark" size={18} /><span>{t("invite.metHere", { n: sparks[0].times + 1 })} {t("invite.sparkQuote", { line: sparks[0].line })}</span></p>
      </div>
    </div>
    <FlameMeter state={view === "lit" ? "lit" : "kindling"} have={view === "lit" ? 2 : 1} quorum={2} />
    <InfoLines nature={flare.sunset} compact />
  {/if}
  {#snippet actions()}
    {#if view === "kindling" || view === "lit"}
      <Button icon="here" onclick={onyes}>{t("invite.yes")}</Button>
      <Button variant="text" onclick={oncondition}>{t("invite.condition")}</Button>
    {:else if view === "missing-key" || view === "gone"}
      <Button variant="secondary">{t("gone.close")}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .words { margin: 0; }
  .where { display: flex; gap: 8px; align-items: flex-start; }
  .where p { margin: 0; }
  .spark { display: flex; gap: 6px; align-items: center; color: var(--accent-text); font-weight: 700; margin-top: 4px !important; }
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
  .center h1, .center p { margin: 0; max-width: 22ch; }
  .skeleton { background: color-mix(in srgb, var(--text) 9%, transparent); border-radius: var(--r-md); animation: pulse 1.4s var(--ease-in-out) infinite; }
  .print-sk { height: 300px; }
  .line { height: 32px; }
  .short { width: 60%; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
