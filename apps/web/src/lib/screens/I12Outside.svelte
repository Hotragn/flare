<!--
  I12 Go outside: the end of every flow points outside, not to more app.
  view "end" follows Done: "You were outside 52 min together" when this phone knows when you
  arrived (2026 direction, B), else "Thanks for coming." Then a calm "Phone away" screen.
  view "go" follows I8.
-->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Flame from "../components/Flame.svelte";
  import FlameAvatars from "../components/FlameAvatars.svelte";
  import Icon from "../components/Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Theme } from "../components/parts";
  let {
    view = "end",
    theme = "light",
    spot = "",
    sunset = "",
    minutes = null,
    photo = "",
    people = [],
    spark = "",
    onclose,
  }: {
    view?: "end" | "go";
    theme?: Theme;
    spot?: string;
    sunset?: string;
    minutes?: number | null;
    /** The Flare's own photo behind the summary; the outdoor scenery when there is none. */
    photo?: string;
    /** Who came, as names this phone already knows (no profiles). */
    people?: string[];
    /** The Spark just left, if any. */
    spark?: string;
    onclose?: () => void;
  } = $props();
  let away = $state(false);
  const headline = $derived(
    view === "go" && spot ? t("outside.go", { spot }) : minutes ? t("outside.together", { min: minutes }) : t("outside.thanks"),
  );
</script>

{#if away}
  <Screen theme="dark" close={false} heading={t("outside.away")}>
    <div class="away">
      <Flame state="lit" size={120} />
      <p class="t-display">{t("outside.away")}</p>
      <p class="t-muted">{t("outside.awayBody")}</p>
    </div>
    {#snippet actions()}<Button variant="secondary" onclick={onclose}>{t("gone.close")}</Button>{/snippet}
  </Screen>
{:else}
  <Screen stage backdrop={photo} fallbackArt close={false} heading={headline}>
    {#snippet hero()}
      <div class="msg">
        {#if people.length}<FlameAvatars people={people.map((name) => ({ name, out: true }))} />{:else}<Flame state="lit" size={96} />{/if}
        <h1 class="t-display">{headline}</h1>
        {#if spark}<p class="spark"><Icon name="spark" size={20} /><span>{t("invite.sparkQuote", { line: spark })}</span></p>{/if}
      </div>
    {/snippet}
    {#if sunset}<p class="t-muted">{t("outside.quiet", { sunset })}</p>{/if}
    {#snippet actions()}
      <Button onclick={() => (away = true)}>{t("outside.awayCta")}</Button>
    {/snippet}
  </Screen>
{/if}

<style>
  .msg { display: flex; flex-direction: column; gap: 10px; }
  .msg h1, .msg p { margin: 0; }
  .spark { display: flex; gap: 8px; align-items: center; font-weight: 700; font-size: calc(1.125rem * var(--text-scale)); color: var(--c-gold-400); }
  .away { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
  .away p { margin: 0; }
  .away :global(svg) { animation: breathe 6s ease-in-out infinite; }
  @keyframes breathe { 50% { opacity: 0.7; transform: scale(0.96); } }
  @media (prefers-reduced-motion: reduce) { .away :global(svg) { animation: none; } }
</style>
